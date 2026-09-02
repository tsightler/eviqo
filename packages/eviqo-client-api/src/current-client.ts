import { EviqoWebsocketConnection as LegacyEviqoWebsocketConnection, WS_URL } from './client';
import { EviqoDevicePageModel } from './models/device-page';
import { EviqoUserModel } from './models/user';
import { calculateHash } from './utils/hash';
import { logger } from './utils/logger';
import { MessageHeader } from './utils/protocol';

/**
 * Current Eviqo web client protocol version observed from app.eviqo.io.
 */
export const EVIQO_WEB_CLIENT_VERSION = '0.109.0';

const CLIENT_TYPE = 'web';
const LOCALE = 'en_US';

type HeaderTuple = [number, number, number, number];

function formatHeader(header: HeaderTuple): string {
  return header.map((value) => value.toString(16).padStart(2, '0')).join(' ');
}

function assertHeader(
  stage: string,
  header: MessageHeader | null,
  expected: HeaderTuple
): void {
  if (header === null) {
    throw new Error(`${stage}: no response header received`);
  }

  const actual: HeaderTuple = [
    header.byte1,
    header.byte2,
    header.byte3,
    header.byte4,
  ];

  if (!actual.every((value, index) => value === expected[index])) {
    throw new Error(
      `${stage}: unexpected response header ${formatHeader(actual)}; expected ${formatHeader(expected)}`
    );
  }
}

/**
 * Eviqo client compatible with the current official web application handshake.
 *
 * The official web client currently performs the following startup exchanges:
 *   01 30 00 01  INIT
 *   00 02 00 03  LOGIN
 *   00 EF 00 05  bootstrap
 *   01 1C 00 07  DEVICE metadata
 *   01 1B 00 09  DEVICE query
 *
 * Eviqo does not publish this protocol, so these values are compatibility
 * details rather than a supported public API contract.
 */
export class EviqoWebsocketConnection extends LegacyEviqoWebsocketConnection {
  private readonly currentUsername: string | null;
  private readonly currentPassword: string | null;
  private currentUser: EviqoUserModel | null = null;
  private currentDevicePages: EviqoDevicePageModel[] = [];

  constructor(
    url: string = WS_URL,
    sessionId: string | null = null,
    username: string | null = null,
    password: string | null = null
  ) {
    super(url, sessionId, username, password);
    this.currentUsername = username;
    this.currentPassword = password;
  }

  /**
   * The legacy client only advances its private outbound counter for messages
   * that do not provide an explicit byte4. The current startup handshake uses
   * explicit request IDs 01/03/05/07, followed by an auto-numbered DEVICE
   * query that must be 09. Seed the legacy counter at the handoff point so all
   * subsequent existing client methods continue with 09, 0A, 0B, ...
   */
  private setNextMessageId(messageId: number): void {
    const internal = this as unknown as { messageCounter: number };
    internal.messageCounter = messageId;
  }

  override async issueInitialization(): Promise<void> {
    logger.debug('Sending current initialization message...');

    await this.sendMessage(
      {
        clientType: CLIENT_TYPE,
        version: EVIQO_WEB_CLIENT_VERSION,
        locale: LOCALE,
      },
      0x01,
      0x30,
      0x00,
      0x01,
      'INIT'
    );

    const result = await this.listen();
    assertHeader('INIT', result.header, [0x00, 0x63, 0x00, 0x01]);
    if (result.payload === null) {
      throw new Error('INIT: response payload missing');
    }
  }

  override async login(): Promise<void> {
    logger.debug('Sending current login message...');

    if (this.currentUsername === null || this.currentPassword === null) {
      throw new Error('User and password must be set');
    }

    await this.sendMessage(
      {
        email: this.currentUsername,
        hash: calculateHash(this.currentUsername, this.currentPassword),
        clientType: CLIENT_TYPE,
        version: EVIQO_WEB_CLIENT_VERSION,
        locale: LOCALE,
      },
      0x00,
      0x02,
      0x00,
      0x03,
      'LOGIN'
    );

    let result = await this.listen();
    assertHeader('LOGIN', result.header, [0x00, 0x02, 0x00, 0x03]);
    if (result.payload === null) {
      throw new Error('LOGIN: response payload missing');
    }
    this.currentUser = result.payload as unknown as EviqoUserModel;

    await this.sendMessage(
      null,
      0x00,
      0xef,
      0x00,
      0x05,
      'POST-LOGIN BOOTSTRAP'
    );
    result = await this.listen();
    assertHeader('POST-LOGIN BOOTSTRAP', result.header, [0x00, 0xef, 0x00, 0x05]);
    if (result.payload === null) {
      throw new Error('POST-LOGIN BOOTSTRAP: response payload missing');
    }

    await this.sendMessage(
      { docType: 'DEVICE' },
      0x01,
      0x1c,
      0x00,
      0x07,
      'DEVICE METADATA'
    );
    result = await this.listen();
    assertHeader('DEVICE METADATA', result.header, [0x01, 0x1c, 0x00, 0x07]);
    if (result.payload === null) {
      throw new Error('DEVICE METADATA: response payload missing');
    }

    // The next existing queryDevices() call must use request ID 0x09.
    this.setNextMessageId(0x09);
  }

  override getUser(): EviqoUserModel | null {
    return this.currentUser;
  }

  override getDevicePages(): EviqoDevicePageModel[] {
    return this.currentDevicePages;
  }

  /**
   * Main client routine using the same current handshake as the MQTT gateway.
   */
  override async run(justScan = false): Promise<void> {
    if (!(await this.connect())) {
      return;
    }

    try {
      await this.issueInitialization();
      await this.login();
      await this.queryDevices();

      const devices = this.getDevices();
      if (devices.length === 0) {
        throw new Error('No devices found');
      }

      const device = devices[0];
      if (device.deviceId === undefined) {
        throw new Error('Device ID was not set');
      }

      const devicePage = await this.requestChargingStatus(device.deviceId);
      this.currentDevicePages.push(devicePage);
      this.extractWidgetMappings(0, devicePage);
      await this.keepalive();

      while (!justScan) {
        await this.keepalive();
        await this.listen(20);
      }
    } finally {
      this.disconnect();
      logger.debug('Connection closed');
    }
  }
}
