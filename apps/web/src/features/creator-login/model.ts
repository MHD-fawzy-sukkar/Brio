export interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    ux_mode: 'popup';
    auto_select: boolean;
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
  prompt?(): void;
  cancel?(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}
