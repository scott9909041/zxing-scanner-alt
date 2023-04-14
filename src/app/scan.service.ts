import { Injectable } from '@angular/core';
import { ZxingScannerComponent } from './zxing-scanner/zxing-scanner.component';
import { ComponentPortal } from '@angular/cdk/portal';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { Observable } from 'rxjs';
import { Result } from '@zxing/library';

@Injectable({
  providedIn: 'root'
})
export class ScanService {

  constructor(private overlay: Overlay) { }

  private overlayRef: OverlayRef;

  private component: ZxingScannerComponent;

  start(): Observable<Result> {
    if (this.overlayRef == null) {
      return new Observable<Result>(subscriber => {
        try {
          this.component = this.initializeScannerInstance();
          this.component.scanSuccess.subscribe(result => {
            this.stop();
            subscriber.next(result);
            subscriber.complete();
          });
        } catch (error) {
          subscriber.error(error);
        }
      });
    }
  }

  stop(): void {
    if (this.overlayRef &&
        this.overlayRef.hasAttached() &&
        this.component &&
        this.component.isReady
      ) {
      this.component.scanStop();
      this.component = null;
      this.overlayRef.detach();
      this.overlayRef = null;
    }
  }

  private initializeScannerInstance(): ZxingScannerComponent {
    this.configureOverlay();
    const scannerPortal = new ComponentPortal(ZxingScannerComponent);
    const componentRef = this.overlayRef.attach(scannerPortal);
    return componentRef.instance;
  }

  private configureOverlay(): void {
    // Configure overlay options
    const config = new OverlayConfig({
      width: '100%',
      height: '100%',
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.block(),
      disposeOnNavigation: true
    });
    this.overlayRef = this.overlay.create(config);
  }
}
