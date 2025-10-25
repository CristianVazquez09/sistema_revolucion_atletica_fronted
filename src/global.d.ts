// src/global.d.ts
export {};

declare global {
  interface Window {
    electron?: {
      listPrinters: () => Promise<Array<{ name: string; description?: string; isDefault?: boolean }>>;
      printTicket: (html: string, deviceName?: string) => Promise<void>;
    };
  }
}
