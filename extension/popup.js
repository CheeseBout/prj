document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveBtn');
  const toggleExtension = document.getElementById('toggleExtension');
  const togglePdfTranslation = document.getElementById('togglePdfTranslation');

  // 1. Load trạng thái đã lưu
  chrome.storage.sync.get(
    ['translationMode', 'extensionEnabled', 'pdfTranslationEnabled'],
    (result) => {
      if (result.translationMode) {
        const savedRadio = document.querySelector(`input[value="${result.translationMode}"]`);
        if (savedRadio) savedRadio.checked = true;
      }

      // Mặc định là bật nếu chưa có giá trị lưu trữ
      if (result.extensionEnabled !== undefined) {
        toggleExtension.checked = result.extensionEnabled;
      }

      // Mặc định tắt chế độ PDF
      togglePdfTranslation.checked = result.pdfTranslationEnabled === true;
    },
  );

  // 2. Gửi tin nhắn ngay khi gạt nút Bật/Tắt
  toggleExtension.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    const selectedMode = document.querySelector('input[name="trans_mode"]:checked').value;

    chrome.storage.sync.set({ extensionEnabled: isEnabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleExtension',
          enabled: isEnabled,
          mode: selectedMode,
        });
      }
    });
  });

  togglePdfTranslation.addEventListener('change', (e) => {
    chrome.storage.sync.set({ pdfTranslationEnabled: e.target.checked });
  });

  // 3. Nút Lưu: Lưu cả Mode, Trạng thái extension và toggle PDF
  saveBtn.addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="trans_mode"]:checked').value;
    const isEnabled = toggleExtension.checked;
    const pdfTranslationEnabled = togglePdfTranslation.checked;

    chrome.storage.sync.set(
      {
        translationMode: selectedMode,
        extensionEnabled: isEnabled,
        pdfTranslationEnabled,
      },
      () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'switchMode',
              mode: selectedMode,
              enabled: isEnabled,
            });
          }
        });

        saveBtn.innerText = 'Đã lưu thành công! ✓';
        saveBtn.style.backgroundColor = '#4caf50';
        setTimeout(() => window.close(), 800);
      },
    );
  });
});
