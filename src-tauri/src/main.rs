// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use windows::core::Interface;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use sysinfo::Disks;
use chardetng::EncodingDetector;
use zip::ZipArchive;

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[cfg(target_os = "windows")]
use windows::{
    core::PCWSTR,
    Win32::{
        Graphics::Gdi::{
            CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject,
            BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP,
        },
        UI::{
            Shell::ExtractIconExW,
            WindowsAndMessaging::{DestroyIcon, DrawIconEx, GetDesktopWindow, HICON, DI_NORMAL},
        },
    },
};

#[cfg(target_os = "windows")]
use std::ffi::c_void;

#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
    modified: Option<u64>,
    created: Option<u64>,
}

// 使用 Windows Shell 获取文件缩略图并缓存为 PNG，返回 PNG 路径
#[tauri::command]
async fn get_system_thumbnail(path: String, width: u32, height: u32) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("仅在 Windows 上支持系统缩略图提取".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::fs::create_dir_all;
        use windows::Win32::UI::Shell::{IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_THUMBNAILONLY, SIIGBF_BIGGERSIZEOK};
        use windows::Win32::Graphics::Gdi::{GetObjectW, BITMAP, SelectObject, BitBlt, SRCCOPY};

        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("文件不存在: {}", path));
        }

        // 缓存目录: %APPDATA%/easyexplorer/system-thumbs
        let mut cache_dir = tauri::api::path::data_dir().ok_or_else(|| "无法获取应用数据目录".to_string())?;
        cache_dir.push("easyexplorer");
        cache_dir.push("system-thumbs");
        create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "无法获取文件名".to_string())?;

        let mut png_path = cache_dir.clone();
        // 简单用文件名+尺寸+版本作为缓存键，避免旧缩略图颜色错误的缓存
        png_path.push(format!("{file_name}_{width}x{height}.v2.png"));

        if png_path.exists() {
            return Ok(png_path.to_string_lossy().to_string());
        }

        unsafe {
            // 创建 ShellItem
            let wide: Vec<u16> = file_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            let shell_item: IShellItem = SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None)
                .map_err(|e| format!("创建 ShellItem 失败: {e}"))?;

            let factory: IShellItemImageFactory = shell_item
                .cast()
                .map_err(|e| format!("获取 IShellItemImageFactory 失败: {e}"))?;

            let size = windows::Win32::Foundation::SIZE {
                cx: width as i32,
                cy: height as i32,
            };

            let flags = SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK;
            let hbitmap = factory
                .GetImage(size, flags)
                .map_err(|e| format!("获取缩略图位图失败: {e}"))?;

            if hbitmap.0 == 0 {
                return Err("Shell 未返回有效缩略图".to_string());
            }

            // 查询位图信息
            let mut bmp: BITMAP = std::mem::zeroed();
            let res = GetObjectW(hbitmap, std::mem::size_of::<BITMAP>() as i32, Some(&mut bmp as *mut _ as *mut _));
            if res == 0 {
                let _ = DeleteObject(hbitmap);
                return Err("获取位图信息失败".to_string());
            }

            let bmp_width = bmp.bmWidth;
            let bmp_height = bmp.bmHeight;

            // 创建内存 DC 和 DIB，用于读取像素
            use windows::Win32::Graphics::Gdi::{GetDC, ReleaseDC};
            let hwnd = GetDesktopWindow();
            let hdc_screen = GetDC(hwnd);
            if hdc_screen.0 == 0 {
                let _ = DeleteObject(hbitmap);
                return Err("获取屏幕 DC 失败".into());
            }

            let hdc_mem = CreateCompatibleDC(hdc_screen);
            if hdc_mem.0 == 0 {
                let _ = ReleaseDC(hwnd, hdc_screen);
                let _ = DeleteObject(hbitmap);
                return Err("创建内存 DC 失败".into());
            }

            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader = BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: bmp_width,
                biHeight: -bmp_height, // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            };

            let mut bits_ptr: *mut c_void = std::ptr::null_mut();
            let hbitmap_dib: HBITMAP = CreateDIBSection(
                hdc_screen,
                &bmi,
                DIB_RGB_COLORS,
                &mut bits_ptr,
                None,
                0,
            )
            .map_err(|e| e.to_string())?;

            if hbitmap_dib.0 == 0 || bits_ptr.is_null() {
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(hwnd, hdc_screen);
                let _ = DeleteObject(hbitmap);
                return Err("创建 DIB 失败".into());
            }

            let old = SelectObject(hdc_mem, hbitmap_dib);

            // 将 Shell 返回的 hbitmap 拷贝到我们的 DIB 中
            let hdc_src = CreateCompatibleDC(hdc_screen);
            if hdc_src.0 == 0 {
                let _ = SelectObject(hdc_mem, old);
                let _ = DeleteObject(hbitmap_dib);
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(hwnd, hdc_screen);
                let _ = DeleteObject(hbitmap);
                return Err("创建源 DC 失败".into());
            }

            let old_src = SelectObject(hdc_src, hbitmap);

            let _ = BitBlt(
                hdc_mem,
                0,
                0,
                bmp_width,
                bmp_height,
                hdc_src,
                0,
                0,
                SRCCOPY,
            );

            // 构造 RGBA 像素缓冲区
            // 注意：DIB 返回的是 BGRA，需要转换为 RGBA，否则 R/B 会颠倒
            let row_bytes = bmp_width as usize * 4;
            let total_bytes = row_bytes * bmp_height as usize;
            let mut bgra = vec![0u8; total_bytes];
            std::ptr::copy_nonoverlapping(bits_ptr as *const u8, bgra.as_mut_ptr(), total_bytes);

            // BGRA -> RGBA
            for chunk in bgra.chunks_mut(4) {
                if chunk.len() == 4 {
                    chunk.swap(0, 2); // B <-> R
                }
            }

            // 清理 GDI 资源
            let _ = SelectObject(hdc_src, old_src);
            let _ = DeleteDC(hdc_src);
            let _ = SelectObject(hdc_mem, old);
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(hwnd, hdc_screen);
            let _ = DeleteObject(hbitmap);

            // 使用 image crate 编码 PNG
            let img_buf = image::RgbaImage::from_raw(bmp_width as u32, bmp_height as u32, bgra)
                .ok_or_else(|| "创建图像缓冲区失败".to_string())?;

            let dyn_img = image::DynamicImage::ImageRgba8(img_buf);
            dyn_img
                .save(&png_path)
                .map_err(|e| format!("保存缩略图失败: {e}"))?;

            Ok(png_path.to_string_lossy().to_string())
        }
    }
}

// 提取 PPTX 缩略图并缓存为图片，返回图片路径
#[tauri::command]
async fn get_ppt_thumbnail(path: String) -> Result<String, String> {
    let ppt_path = PathBuf::from(&path);
    if !ppt_path.exists() {
        return Err(format!("PPT 文件不存在: {}", path));
    }

    // 只对 .pptx 尝试缩略图提取，其他扩展名直接报错，让前端回退到默认图标
    if ppt_path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("pptx"))
        != Some(true)
    {
        return Err("仅支持从 .pptx 中提取缩略图".to_string());
    }

    // 缓存目录: %APPDATA%/easyexplorer/ppt-thumbs
    let mut cache_dir = tauri::api::path::data_dir().ok_or_else(|| "无法获取应用数据目录".to_string())?;
    cache_dir.push("easyexplorer");
    cache_dir.push("ppt-thumbs");
    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let file_name = ppt_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "无法获取 PPT 文件名".to_string())?;

    // 使用原始缩略图扩展名，如果找不到则返回错误
    let mut thumb_path = cache_dir.clone();
    thumb_path.push(format!("{file_name}.thumb"));

    // 如果已存在缓存文件，直接返回
    if thumb_path.exists() {
        return Ok(thumb_path.to_string_lossy().to_string());
    }

    // 从 pptx (zip) 中提取缩略图
    let file = std::fs::File::open(&ppt_path).map_err(|e| format!("打开 PPTX 失败: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("解析 PPTX 失败: {}", e))?;

    let candidates = [
        "docProps/thumbnail.jpeg",
        "docProps/thumbnail.jpg",
        "docProps/thumbnail.png",
    ];

    let mut found = false;
    for name in &candidates {
        if let Ok(mut thumb_file) = archive.by_name(name) {
            let mut buf = Vec::new();
            thumb_file
                .read_to_end(&mut buf)
                .map_err(|e| format!("读取 PPTX 缩略图失败: {}", e))?;

            // 根据原始扩展名设置缓存文件后缀
            let ext = if name.ends_with(".png") {
                "png"
            } else if name.ends_with(".jpeg") || name.ends_with(".jpg") {
                "jpg"
            } else {
                "bin"
            };

            thumb_path.set_extension(ext);
            fs::write(&thumb_path, &buf).map_err(|e| format!("写入缩略图缓存失败: {}", e))?;
            found = true;
            break;
        }
    }

    if !found {
        return Err("PPTX 中未找到缩略图".to_string());
    }

    Ok(thumb_path.to_string_lossy().to_string())
}

// 右键菜单相关结构（预留，后续实现）
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct ContextMenuParams {
    path: String,
    template: Option<Vec<MenuItem>>,
    is_directory: bool,
    is_favorite: bool,
    is_current_dir: bool,
    group_name: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct MenuItem {
    label: String,
}

// 获取文件列表
#[tauri::command]
async fn read_directory(path: String) -> Result<Vec<FileInfo>, String> {
    println!("读取目录: {}", path);
    
    // 验证路径是否存在
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(format!("路径不存在: {}", path));
    }
    
    let entries = fs::read_dir(&path).map_err(|e| {
        let error_msg = format!("无法读取目录 {}: {}", path, e);
        println!("{}", error_msg);
        error_msg
    })?;
    
    let mut files = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(e) => {
                    println!("无法获取元数据: {:?}, 错误: {}", entry.path(), e);
                    continue; // 跳过无法访问的文件
                }
            };
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path().to_string_lossy().to_string();

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            let created = metadata
                .created()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            files.push(FileInfo {
                name,
                path,
                is_directory: metadata.is_dir(),
                size: metadata.len(),
                modified,
                created,
            });
        }
    }

    Ok(files)
}

// 复制文件/文件夹
#[tauri::command]
async fn copy_file(source: String, destination: String) -> Result<(), String> {
    let src_path = Path::new(&source);
    let dest_path = Path::new(&destination);

    if src_path.is_dir() {
        copy_dir_recursive(src_path, dest_path).map_err(|e| e.to_string())?;
    } else {
        fs::copy(src_path, dest_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// 递归复制目录
fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    if !dest.exists() {
        fs::create_dir_all(dest)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}

// 删除文件/文件夹
#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if file_path.is_dir() {
        fs::remove_dir_all(file_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// 创建文件夹
#[tauri::command]
async fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

// 重命名文件/文件夹
#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

// 磁盘信息结构
#[derive(Debug, Serialize, Deserialize)]
struct DriveInfo {
    name: String,
    label: String,
    total_space: u64,
    available_space: u64,
    used_space: u64,
    usage_percent: f32,
    file_system: String,
    drive_type: String,
}

// 获取磁盘驱动器列表和详细信息
#[tauri::command]
async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 使用 wmic 获取所有驱动器（包括网络驱动器）
        let output = Command::new("wmic")
            .args(&["logicaldisk", "get", "name,volumename,size,freespace,drivetype,filesystem", "/format:csv"])
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // 使用 sysinfo 作为补充
        let disks = Disks::new_with_refreshed_list();
        let mut disk_map = std::collections::HashMap::new();
        for disk in disks.list() {
            let mount = disk.mount_point().to_string_lossy().to_string();
            disk_map.insert(mount, disk);
        }
        
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() < 7 {
                continue;
            }
            
            // CSV格式: Node,DriveType,FileSystem,FreeSpace,Name,Size,VolumeName
            let drive_type_num = parts[1].trim();
            let file_system_raw = parts[2].trim();
            let free_space_str = parts[3].trim();
            let name = parts[4].trim();
            let size_str = parts[5].trim();
            let volume_name = parts[6].trim();
            
            if name.is_empty() || name.len() < 2 {
                continue;
            }
            
            let name_with_slash = if !name.ends_with('\\') {
                format!("{}\\", name)
            } else {
                name.to_string()
            };
            
            // 解析驱动器类型
            let (drive_type, default_label) = match drive_type_num {
                "2" => ("Removable", "可移动磁盘"),
                "3" => ("HDD", "本地磁盘"),
                "4" => ("Network", "网络驱动器"),
                "5" => ("CD-ROM", "光盘驱动器"),
                _ => {
                    // 跳过未知类型的驱动器
                    continue;
                }
            };
            
            // 获取卷标
            let label = if volume_name.is_empty() {
                format!("{} ({})", default_label, name)
            } else {
                volume_name.to_string()
            };
            
            // 尝试从 sysinfo 获取详细信息
            let (total_space, available_space, file_system) = if let Some(disk) = disk_map.get(&name_with_slash) {
                (
                    disk.total_space(),
                    disk.available_space(),
                    disk.file_system().to_string_lossy().to_string()
                )
            } else {
                // 从 wmic 输出解析
                let size = size_str.parse::<u64>().unwrap_or(0);
                let free = free_space_str.parse::<u64>().unwrap_or(0);
                let fs = if file_system_raw.is_empty() {
                    "Unknown".to_string()
                } else {
                    file_system_raw.to_string()
                };
                (size, free, fs)
            };
            
            let used_space = total_space.saturating_sub(available_space);

            // 如果可用空间为 0，则不在列表中显示该驱动器
            if available_space == 0 {
                continue;
            }
            let usage_percent = if total_space > 0 {
                (used_space as f64 / total_space as f64 * 100.0) as f32
            } else {
                0.0
            };
            
            drives.push(DriveInfo {
                name: name_with_slash,
                label,
                total_space,
                available_space,
                used_space,
                usage_percent,
                file_system,
                drive_type: drive_type.to_string(),
            });
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let disks = Disks::new_with_refreshed_list();
        for disk in disks.list() {
            let name = disk.mount_point().to_string_lossy().to_string();
            let total_space = disk.total_space();
            let available_space = disk.available_space();
            let used_space = total_space.saturating_sub(available_space);
            let usage_percent = if total_space > 0 {
                (used_space as f64 / total_space as f64 * 100.0) as f32
            } else {
                0.0
            };

            let label = disk.name().to_string_lossy().to_string();
            let label = if label.is_empty() {
                format!("磁盘 ({})", name)
            } else {
                label
            };

            let file_system = disk.file_system().to_string_lossy().to_string();
            
            let drive_type = match disk.kind() {
                sysinfo::DiskKind::HDD => "HDD",
                sysinfo::DiskKind::SSD => "SSD",
                sysinfo::DiskKind::Unknown(_) => "Unknown",
            };

            drives.push(DriveInfo {
                name,
                label,
                total_space,
                available_space,
                used_space,
                usage_percent,
                file_system,
                drive_type: drive_type.to_string(),
            });
        }
    }

    // 按驱动器名称排序（C:\ < D:\ < E:\ ...）
    drives.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(drives)
}

// 在资源管理器中打开
#[tauri::command]
async fn show_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(&["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(&["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/")))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// 用默认程序打开文件
#[tauri::command]
async fn open_with_default(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// 打开方式对话框（Windows）
#[tauri::command]
#[cfg(target_os = "windows")]
async fn open_with_dialog(path: String) -> Result<(), String> {
    std::process::Command::new("rundll32.exe")
        .args(&["shell32.dll,OpenAs_RunDLL", &path])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
async fn open_with_dialog(_path: String) -> Result<(), String> {
    Err("此功能仅在 Windows 上可用".to_string())
}

// 检查路径是否存在
#[tauri::command]
async fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

// 智能读取文本：优先 UTF-8，失败则自动检测编码（支持 GBK/ANSI 等）
#[tauri::command]
async fn read_text_flexible(path: String, max_len: Option<usize>) -> Result<String, String> {
    let max_len = max_len.unwrap_or(200_000); // 防止一次读取超大文件

    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    let file = std::fs::File::open(&path_buf)
        .map_err(|e| format!("无法打开文件 {}: {}", path, e))?;

    let mut buf = Vec::new();
    file
        .take(max_len as u64)
        .read_to_end(&mut buf)
        .map_err(|e| format!("读取文件 {} 失败: {}", path, e))?;

    // 1. 尝试按 UTF-8 解码
    if let Ok(s) = String::from_utf8(buf.clone()) {
        return Ok(s);
    }

    // 2. 自动探测编码并解码为 UTF-8
    let mut detector = EncodingDetector::new();
    detector.feed(&buf, true);
    let enc = detector.guess(None, true);
    let (cow, _, _) = enc.decode(&buf);

    Ok(cow.into_owned())
}

// 连接路径
#[tauri::command]
async fn join_path(base: String, path: String) -> Result<String, String> {
    let base_path = Path::new(&base);
    let joined = base_path.join(path);
    Ok(joined.to_string_lossy().to_string())
}

// 删除目录
#[tauri::command]
async fn remove_directory(path: String) -> Result<(), String> {
    fs::remove_dir_all(path).map_err(|e| e.to_string())
}

// 删除文件
#[tauri::command]
async fn remove_file(path: String) -> Result<(), String> {
    fs::remove_file(path).map_err(|e| e.to_string())
}

// 在资源管理器中打开（别名）
#[tauri::command]
async fn open_in_explorer(path: String) -> Result<(), String> {
    show_in_explorer(path).await
}

// 提取 exe 图标并缓存为 PNG，返回 PNG 路径
#[tauri::command]
async fn get_exe_icon(path: String) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("仅在 Windows 上支持 exe 图标提取".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::fs::create_dir_all;

        let exe_path = Path::new(&path);
        if !exe_path.exists() {
            return Err(format!("exe 不存在: {}", path));
        }

        // 缓存目录: %APPDATA%/easyexplorer/exe-icons
        let mut cache_dir = tauri::api::path::data_dir().ok_or_else(|| "无法获取应用数据目录".to_string())?;
        cache_dir.push("easyexplorer");
        cache_dir.push("exe-icons");
        create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

        let exe_name = exe_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "无法获取 exe 文件名".to_string())?;
        let mut icon_path = cache_dir.clone();
        // 加上版本后缀，避免旧缓存颜色错误
        icon_path.push(format!("{exe_name}.v2.png"));

        if icon_path.exists() {
            return Ok(icon_path.to_string_lossy().to_string());
        }

        // 直接从 exe 自身提取图标：使用 ExtractIconExW 获取 HICON
        let wide: Vec<u16> = exe_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut hicon_large: HICON = HICON(0);
        let mut hicon_small: HICON = HICON(0);
        unsafe {
            // 这里先尝试获取大图标，如果失败则退回小图标
            let count = ExtractIconExW(
                PCWSTR(wide.as_ptr()),
                0,
                Some(&mut hicon_large),
                Some(&mut hicon_small),
                1,
            );

            if count == 0 {
                return Err("无法从 exe 提取图标".into());
            }
        }

        // 优先使用大图标，其次小图标
        let hicon: HICON = if hicon_large.0 != 0 { hicon_large } else { hicon_small };

        if hicon.0 == 0 {
            return Err("无法提取 exe 图标".into());
        }

        // 使用更大的位图尺寸，让导出的 PNG 更清晰（后续可以在 UI 中按需缩放）
        const ICON_SIZE: i32 = 128;

        unsafe {
            use windows::Win32::Graphics::Gdi::{GetDC, ReleaseDC};

            let hwnd = GetDesktopWindow();
            let hdc_screen = GetDC(hwnd);
            if hdc_screen.0 == 0 {
                let _ = DestroyIcon(hicon);
                return Err("获取屏幕 DC 失败".into());
            }

            let hdc_mem = CreateCompatibleDC(hdc_screen);
            if hdc_mem.0 == 0 {
                let _ = ReleaseDC(hwnd, hdc_screen);
                let _ = DestroyIcon(hicon);
                return Err("创建内存 DC 失败".into());
            }

            // 创建 32 位带 alpha 的 DIB section，直接获取像素指针以保留透明度
            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader = BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: ICON_SIZE,
                biHeight: -ICON_SIZE, // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            };

            let mut bits_ptr: *mut c_void = std::ptr::null_mut();
            let hbitmap: HBITMAP = CreateDIBSection(
                hdc_screen,
                &bmi,
                DIB_RGB_COLORS,
                &mut bits_ptr,
                None,
                0,
            )
            .map_err(|e| e.to_string())?;
            if hbitmap.0 == 0 || bits_ptr.is_null() {
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(hwnd, hdc_screen);
                let _ = DestroyIcon(hicon);
                return Err("创建 DIB 位图失败".into());
            }

            // 将 DIB 选入内存 DC，绘制图标
            let old = SelectObject(hdc_mem, hbitmap);
            let _ = DrawIconEx(
                hdc_mem,
                0,
                0,
                hicon,
                ICON_SIZE,
                ICON_SIZE,
                0,
                None,
                DI_NORMAL,
            );

            // 从 DIB section 中直接读取像素（BGRA 排列，32 位），并转换为 RGBA
            let pixel_count = (ICON_SIZE * ICON_SIZE * 4) as usize;
            let pixels_slice = std::slice::from_raw_parts(bits_ptr as *const u8, pixel_count);
            let mut pixels = Vec::with_capacity(pixel_count);
            pixels.extend_from_slice(pixels_slice);

            // BGRA -> RGBA（交换 R/B 通道）
            for chunk in pixels.chunks_mut(4) {
                if chunk.len() == 4 {
                    chunk.swap(0, 2);
                }
            }

            // 清理 GDI 资源
            let _ = SelectObject(hdc_mem, old);
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(hwnd, hdc_screen);
            let _ = DestroyIcon(hicon);

            let img_buffer =
                image::RgbaImage::from_raw(ICON_SIZE as u32, ICON_SIZE as u32, pixels)
                    .ok_or_else(|| "创建图像缓冲失败".to_string())?;

            let mut file = std::fs::File::create(&icon_path).map_err(|e| e.to_string())?;
            image::DynamicImage::ImageRgba8(img_buffer)
                .write_to(&mut file, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;
        }

        Ok(icon_path.to_string_lossy().to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_directory,
            copy_file,
            delete_file,
            create_directory,
            rename_file,
            get_drives,
            show_in_explorer,
            open_with_default,
            open_with_dialog,
            path_exists,
            join_path,
            remove_directory,
            remove_file,
            open_in_explorer,
            get_exe_icon,
            get_system_thumbnail,
            get_ppt_thumbnail,
            read_text_flexible,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用时出错");
}

