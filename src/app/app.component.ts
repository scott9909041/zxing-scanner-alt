import { Component } from '@angular/core';
import { ScanService } from './scan.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  constructor(private scanService: ScanService) {}

  startScan(): void {
    this.scanService.start().subscribe(resp => setTimeout(() => alert(resp)));
  }

  stopScan(): void {
    this.scanService.stop();
  }
}
