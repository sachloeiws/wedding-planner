import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const baseOptions = {
  confirmButtonColor: '#8E9E8C',
  cancelButtonColor: '#A6998A',
  customClass: {
    popup: 'wedding-alert-popup',
    title: 'wedding-alert-title',
    htmlContainer: 'wedding-alert-content',
    confirmButton: 'wedding-alert-button',
    cancelButton: 'wedding-alert-button'
  }
};

export const showSuccess = (title: string, text?: string) => Swal.fire({
  ...baseOptions,
  icon: 'success',
  title,
  text,
  confirmButtonText: '確定'
});

export const showWarning = (title: string, text?: string) => Swal.fire({
  ...baseOptions,
  icon: 'warning',
  title,
  text,
  confirmButtonText: '確定'
});

export const showError = (title: string, text?: string) => Swal.fire({
  ...baseOptions,
  icon: 'error',
  title,
  text,
  confirmButtonText: '確定'
});

export const showConfirm = async (title: string, text?: string) => {
  const result = await Swal.fire({
    ...baseOptions,
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: '確定',
    cancelButtonText: '取消',
    reverseButtons: true,
    focusCancel: true
  });
  return result.isConfirmed;
};

export type ConflictChoice = 'cloud' | 'merge' | 'local';

export const showConflict = async (editorId: string, sectionLabels: string[]): Promise<ConflictChoice> => {
  const editorCode = editorId ? editorId.slice(0, 8).toUpperCase() : '未知裝置';
  const result = await Swal.fire({
    ...baseOptions,
    icon: 'warning',
    title: '偵測到共同編輯衝突',
    html: `<p><strong>編輯者 ${editorCode}</strong> 已更新：${sectionLabels.join('、')}</p><p style="margin-top:.75rem">您目前也有尚未儲存的修改，系統尚未覆蓋您的畫面。</p>`,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: '載入雲端版本',
    denyButtonText: '合併兩邊資料',
    cancelButtonText: '保留本機修改',
    reverseButtons: true,
    allowOutsideClick: false
  });
  if (result.isConfirmed) return 'cloud';
  if (result.isDenied) return 'merge';
  return 'local';
};
