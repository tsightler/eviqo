import {
  EVIQO_WEB_CLIENT_VERSION,
  EviqoWebsocketConnection,
} from '../src/current-client';
import { MessageHeader } from '../src/utils/protocol';

function header(
  byte1: number,
  byte2: number,
  byte3: number,
  byte4: number,
  hasPayload = true
): MessageHeader {
  return {
    byte1,
    byte2,
    byte3,
    byte4,
    hasPayload,
    headerHex: Buffer.from([byte1, byte2, byte3, byte4]).toString('hex'),
    totalLength: hasPayload ? 5 : 4,
  };
}

describe('current Eviqo web handshake', () => {
  it('replays the observed 01/03/05/07/09 startup sequence', async () => {
    const client = new EviqoWebsocketConnection(
      'wss://example.invalid/dashws',
      null,
      'user@example.com',
      'password'
    );

    const sent: Buffer[] = [];
    (client as unknown as { ws: { send: (message: Buffer) => void } }).ws = {
      send: (message: Buffer) => sent.push(Buffer.from(message)),
    };

    jest
      .spyOn(client, 'listen')
      .mockResolvedValueOnce({
        header: header(0x00, 0x63, 0x00, 0x01),
        payload: { initialized: true },
      })
      .mockResolvedValueOnce({
        header: header(0x00, 0x02, 0x00, 0x03),
        payload: { user: { id: 1 } },
      })
      .mockResolvedValueOnce({
        header: header(0x00, 0xef, 0x00, 0x05),
        payload: { bootstrap: true },
      })
      .mockResolvedValueOnce({
        header: header(0x01, 0x1c, 0x00, 0x07),
        payload: { docType: 'DEVICE' },
      })
      .mockResolvedValueOnce({
        header: header(0x01, 0x1b, 0x00, 0x09),
        payload: { docs: [] },
      });

    await client.issueInitialization();
    await client.login();
    await client.queryDevices();

    expect(sent.map((message) => message.subarray(0, 4).toString('hex'))).toEqual([
      '01300001',
      '00020003',
      '00ef0005',
      '011c0007',
      '011b0009',
    ]);

    expect(JSON.parse(sent[0].subarray(4).toString('utf-8'))).toEqual({
      clientType: 'web',
      version: EVIQO_WEB_CLIENT_VERSION,
      locale: 'en_US',
    });

    expect(JSON.parse(sent[3].subarray(4).toString('utf-8'))).toEqual({
      docType: 'DEVICE',
    });

    expect(JSON.parse(sent[4].subarray(4).toString('utf-8'))).toMatchObject({
      docType: 'DEVICE',
      mode: 'MATCH_ALL',
      viewType: 'LIST',
    });

    // Existing post-login methods should continue naturally at 0x0A.
    await client.sendMessage(null, 0x00, 0x06, 0x00, undefined, 'TEST NEXT');
    expect(sent[5].subarray(0, 4).toString('hex')).toBe('0006000a');
  });

  it('uses the current observed web client version', () => {
    expect(EVIQO_WEB_CLIENT_VERSION).toBe('0.109.0');
  });

  it('rejects an unexpected initialization response header', async () => {
    const client = new EviqoWebsocketConnection(
      'wss://example.invalid/dashws',
      null,
      'user@example.com',
      'password'
    );

    (client as unknown as { ws: { send: () => void } }).ws = {
      send: () => undefined,
    };

    jest.spyOn(client, 'listen').mockResolvedValueOnce({
      header: header(0x01, 0x30, 0x00, 0x01),
      payload: { initialized: true },
    });

    await expect(client.issueInitialization()).rejects.toThrow(
      'INIT: unexpected response header'
    );
  });
});
