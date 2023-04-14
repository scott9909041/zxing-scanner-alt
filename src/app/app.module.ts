import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { ZxingScannerModule } from './zxing-scanner/zxing-scanner.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    ZxingScannerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
