document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-content');
    const tabs = sidebar.querySelectorAll('li');
    const tabContents = content.querySelectorAll('.tab-content');

    function setActiveTab(tabId) {
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(tabContent => tabContent.classList.remove('active'));

        const activeTab = sidebar.querySelector(`[data-tab="${tabId}"]`);
        const activeContent = content.querySelector(`#${tabId}`);

        if (activeTab && activeContent) {
            activeTab.classList.add('active');
            activeContent.classList.add('active');
        }
    }

    sidebar.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const tabId = e.target.getAttribute('data-tab');
            setActiveTab(tabId);
        }
    });

    content.addEventListener('scroll', () => {
        const scrollPosition = content.scrollTop;
        let activeTabId = null;

        tabContents.forEach(tabContent => {
            const tabTop = tabContent.offsetTop;
            const tabBottom = tabTop + tabContent.offsetHeight;

            if (scrollPosition >= tabTop && scrollPosition < tabBottom) {
                activeTabId = tabContent.id;
            }
        });

        if (activeTabId) {
            setActiveTab(activeTabId);
        }
    });
});
