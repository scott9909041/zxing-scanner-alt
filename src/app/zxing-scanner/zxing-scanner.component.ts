import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {
  BrowserCodeReader,
  BrowserMultiFormatReader,
  IBrowserCodeReaderOptions,
  IScannerControls
} from '@zxing/browser';
import { DecodeContinuouslyCallback } from '@zxing/browser/esm/common/DecodeContinuouslyCallback';
import {
  BarcodeFormat,
  DecodeHintType,
  Exception
} from '@zxing/library';

const DEFAULT_ZOOM_STEP = 2;

@Component({
  selector: 'app-zxing-scanner',
  templateUrl: './zxing-scanner.component.html',
  styleUrls: ['./zxing-scanner.component.scss']
})
export class ZxingScannerComponent implements OnInit, OnDestroy {

  constructor() {
    // computed data
    this.hasNavigator = typeof navigator !== 'undefined';
    this.isMediaDevicesSupported = this.hasNavigator && !!navigator.mediaDevices;
  }

  isReady: boolean;

  private _codeReader: BrowserMultiFormatReader;

  /**
   * Exposes the current code reader, so the user can use it's APIs.
   */
  get codeReader(): BrowserMultiFormatReader {
    return this._codeReader;
  }

  /**
   * Has `navigator` access.
   */
  private hasNavigator: boolean;

  /**
   * Says if some native API is supported.
   */
  private isMediaDevicesSupported: boolean;

  /**
   * If the user-agent allowed the use of the camera or not.
   */
  private hasPermission: boolean | null;


  private _device: MediaDeviceInfo;

  private _controls: IScannerControls;

  private _capabilities: MediaTrackCapabilities;

  _zoomAvailable: boolean;

  _zoomConfig: ZoomConfig;


  /** Delay time between subsequent successful decode results. */
  @Input() delayBetweenScanSuccess = 1000;

  /** Delay time between decode attempts made by the scanner. */
  @Input() delayBetweenScanAttempts = 200;

  
  /**
   * How the video element shoud be fit inside the :host container.
   */
  @Input()
  videoFitMode: 'fill' | 'contain' | 'cover' | 'scale-down' | 'none' = 'cover';

  /**
   * Emitts events when the users answers for permission.
   */
  @Output() permissionResponse: EventEmitter<any> = new EventEmitter();


  /**
   * Emits events when a barcode is decoded.
   */
  @Output() scanSuccess: EventEmitter<string> = new EventEmitter();

  /**
   * Emits events when decoding does not succeed.
   */
  @Output() scanFailure: EventEmitter<Exception | undefined> = new EventEmitter();


  @ViewChild('video', { static: true }) videoElemRef: ElementRef<HTMLVideoElement>;


  ngOnInit(): void {
    this.init();
  }

  ngOnDestroy(): void {
    console.log('ngOnDestroy');
  }

  async init(): Promise<void> {
    await this.initAutostart();
  }

  scanStop(): void {
    if (this._controls) {
      this._controls.stop();
    }
  }

  private async initAutostart(): Promise<void> {

    let hasPermission: boolean;

    try {
      // Asks for permission before enumerating devices so it can get all the device's info
      hasPermission = await this.askForPermission();
    } catch (e) {
      console.error('Exception occurred while asking for permission:', e);
      return;
    }

    // from this point, things gonna need permissions
    if (hasPermission) {
      const devices = await this.updateVideoInputDevices();
      await this.autostartScanner([...devices]);
    }
  }

  /**
   * Gets and registers all cammeras.
   */
  async askForPermission(): Promise<boolean> {

    if (!this.hasNavigator) {
      console.error('zxing-scanner', 'Can\'t ask permission, navigator is not present.');
      this.setPermission(null);
      return this.hasPermission;
    }

    if (!this.isMediaDevicesSupported) {
      console.error('zxing-scanner', 'Can\'t get user media, this is not supported.');
      this.setPermission(null);
      return this.hasPermission;
    }

    let stream: MediaStream;
    let permission: boolean;

    try {
      // Will try to ask for permission
      stream = await this.getAnyVideoDevice();
      permission = !!stream;
    } catch (err) {
      return this.handlePermissionException(err);
    } finally {
      this.terminateStream(stream);
    }

    this.setPermission(permission);

    // Returns the permission
    return permission;
  }

  getAnyVideoDevice(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({ video: true });
  }

  /**
   * Returns the filtered permission.
   */
  private handlePermissionException(err: DOMException): boolean {

    // failed to grant permission to video input
    console.error('zxing-scanner', 'Error when asking for permission.', err);

    let permission: boolean;

    switch (err.name) {

      // usually caused by not secure origins
      case 'NotSupportedError':
        console.warn('zxing-scanner', err.message);
        // could not claim
        permission = null;
        // can't check devices
        // this.hasDevices.next(null);
        break;

      // user denied permission
      case 'NotAllowedError':
        console.warn('zxing-scanner', err.message);
        // claimed and denied permission
        permission = false;
        // this means that input devices exists
        // this.hasDevices.next(true);
        break;

      // the device has no attached input devices
      case 'NotFoundError':
        console.warn('zxing-scanner', err.message);
        // no permissions claimed
        permission = null;
        // because there was no devices
        // this.hasDevices.next(false);
        // tells the listener about the error
        // this.camerasNotFound.next(err);
        break;

      case 'NotReadableError':
        console.warn('zxing-scanner', 'Couldn\'t read the device(s)\'s stream, it\'s probably in use by another app.');
        // no permissions claimed
        permission = null;
        // there are devices, which I couldn't use
        // this.hasDevices.next(false);
        // tells the listener about the error
        // this.camerasNotFound.next(err);
        break;

      default:
        console.warn('zxing-scanner', 'I was not able to define if I have permissions for camera or not.', err);
        // unknown
        permission = null;
        // this.hasDevices.next(undefined;
        break;

    }

    this.setPermission(permission);

    // tells the listener about the error
    this.permissionResponse.error(err);

    return permission;
  }

  /**
   * Terminates a stream and it's tracks.
   */
  private terminateStream(stream: MediaStream) {

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    stream = undefined;
  }

  /**
   * Discovers and updates known video input devices.
   */
  async updateVideoInputDevices(): Promise<MediaDeviceInfo[]> {

    // permissions aren't needed to get devices, but to access them and their info
    const devices = await BrowserCodeReader.listVideoInputDevices() || [];
    const hasDevices = devices && devices.length > 0;

    // stores discovered devices and updates information
    // this.hasDevices.next(hasDevices);
    // this.camerasFound.next([...devices]);

    if (!hasDevices) {
      // this.camerasNotFound.next();
    }

    return devices;
  }

  /**
   * Starts the scanner with the back camera otherwise take the last
   * available device.
   */
  private async autostartScanner(devices: MediaDeviceInfo[]): Promise<void> {

    const matcher = ({ label }) => /後|back|trás|rear|traseira|environment|ambiente/gi.test(label);

    // select the rear camera by default, otherwise take the last camera.
    const device = devices.find(matcher) || devices.pop();

    if (!device) {
      throw new Error('Impossible to autostart, no input devices available.');
    }

    await this.setDevice(device);
  }

  private async setDevice(device: MediaDeviceInfo): Promise<void> {

    // correctly sets the new (or none) device
    this._device = device || undefined;

    // if enabled, starts scanning
    if (device) {
      await this.scanFromDevice(device.deviceId);
    }
  }

  /**
   * Retorna um code reader, cria um se nenhume existe.
   */
  private getCodeReader(): BrowserMultiFormatReader {

    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]);

    const options: IBrowserCodeReaderOptions = {
      delayBetweenScanSuccess: this.delayBetweenScanSuccess,
      delayBetweenScanAttempts: this.delayBetweenScanAttempts
    }

    return new BrowserMultiFormatReader(hints, options);
  }

  /**
   * Starts the continuous scanning for the given device.
   *
   * @param deviceId The deviceId from the device.
   */
  private async scanFromDevice(deviceId: string): Promise<void> {

    const videoElement = this.videoElemRef.nativeElement;

    this._codeReader = this.getCodeReader();

    const callBack: DecodeContinuouslyCallback = (result, error, controls): void => {
      if (result) {
        this.scanSuccess.next(result.getText());
      } else {
        this.scanFailure.next(error);
      }
    }

    this._controls = await this._codeReader.decodeFromVideoDevice(deviceId, videoElement, callBack);

    this.isReady = true;

    const trackFilter = (track) => {
      return [track];
    }

    this._capabilities = this._controls.streamVideoCapabilitiesGet(trackFilter);

    console.log(this._capabilities);

    this.initZoomControl(this._capabilities['zoom']);
  }

  private initZoomControl(zoom: any): void {
    if (zoom) {
      const value = zoom.min + DEFAULT_ZOOM_STEP;
      this._zoomConfig = {
        min: zoom.min,
        max: zoom.max,
        value
      };
      this._zoomAvailable = true;
      this.applyZooming(value);
    }
  }

  applyZooming(value: number): void {
    this._controls?.streamVideoConstraintsApply({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
  }

  zoomCtrlChanged(value: number): void {
    console.log(value);
    this.applyZooming(value);
  }

  private setPermission(hasPermission: boolean | null): void {
    this.hasPermission = hasPermission;
    // this.permissionResponse.next(hasPermission);
  }
}

interface ZoomConfig {
  min: number;
  max: number;
  value: number;
}

