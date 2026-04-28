document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveBtn');
  const toggleExtension = document.getElementById('toggleExtension');

  // 1. Load trạng thái đã lưu
  chrome.storage.sync.get(['translationMode', 'extensionEnabled'], (result) => {
    if (result.translationMode) {
      document.querySelector(`input[value="${result.translationMode}"]`).checked = true;
    }
    // Mặc định là bật nếu chưa có giá trị lưu trữ
    if (result.extensionEnabled !== undefined) {
      toggleExtension.checked = result.extensionEnabled;
    }
  });

  // 2. Gửi tin nhắn ngay khi gạt nút Bật/Tắt
  toggleExtension.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    const selectedMode = document.querySelector('input[name="trans_mode"]:checked').value;
    
    chrome.storage.sync.set({ extensionEnabled: isEnabled });
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggleExtension", enabled: isEnabled, mode: selectedMode });
      }
    });
  });

  // 3. Nút Lưu: Lưu cả Mode và Trạng thái
  saveBtn.addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="trans_mode"]:checked').value;
    const isEnabled = toggleExtension.checked;
    
    chrome.storage.sync.set({ translationMode: selectedMode, extensionEnabled: isEnabled }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "switchMode", mode: selectedMode, enabled: isEnabled });
        }
      });
      
      saveBtn.innerText = "Đã lưu thành công! ✓";
      saveBtn.style.backgroundColor = "#4caf50";
      setTimeout(() => window.close(), 800);
    });
  });
});