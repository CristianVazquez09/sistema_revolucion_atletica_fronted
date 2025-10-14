import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// 👇 IMPORTA Y REGISTRA EL LOCALE
import { registerLocaleData } from '@angular/common';
import esMX from '@angular/common/locales/es-MX';
registerLocaleData(esMX);
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
