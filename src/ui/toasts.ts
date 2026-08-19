/**
 * Toasts UI component for Google Docs notifications and interactive approval prompts
 */
export class ToastManager {
  private containerId: string;

  constructor(containerId: string = 'toast-container') {
    this.containerId = containerId;
  }

  getContainer(): HTMLElement | null {
    let container = document.getElementById(this.containerId);
    if (!container && typeof document !== 'undefined') {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  show(message: string, duration: number = 3000): void {
    if (typeof document === 'undefined') return;
    const container = this.getContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  showAction(message: string, actionText: string, onAction: () => void, duration: number = 10000): void {
    if (typeof document === 'undefined') return;
    const container = this.getContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-action';
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast-btn">${actionText}</button>
    `;

    const btn = toast.querySelector('.toast-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        onAction();
        toast.remove();
      });
    }

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
      }
    }, duration);
  }
}

export const toastManager = new ToastManager();
