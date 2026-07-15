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
