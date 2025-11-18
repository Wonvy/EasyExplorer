// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use sysinfo::Disks;

#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
    modified: Option<u64>,
    created: Option<u64>,
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
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用时出错");
}

