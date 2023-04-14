import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZxingScannerComponent } from './zxing-scanner.component';
import { OverlayModule } from '@angular/cdk/overlay';



@NgModule({
  declarations: [ZxingScannerComponent],
  imports: [
    CommonModule,
    OverlayModule
  ]
})
export class ZxingScannerModule { }
