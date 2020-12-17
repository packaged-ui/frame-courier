import hashSum from "hash-sum";

const _EVENT_PREFIX = '_frame_courier--';
export const events = {
  LOADED: _EVENT_PREFIX + 'loaded', // iframe notifies top that it has loaded the script
  SETUP: _EVENT_PREFIX + 'setup', // iframe receives id
  PROBE: _EVENT_PREFIX + 'probe', // handshake with frame to see if it accepts messages
  READY: _EVENT_PREFIX + 'ready', // iframe all other frames that it has been initialized and is ready to receive messages
  MESSAGE_RESPONSE: _EVENT_PREFIX + 'message-response',
};

export class SetupPayload
{
  constructor()
  {
    this.frameId = null;
    this.frameTags = [];
  }

  static fromObject(obj)
  {
    return Object.assign(new this(), obj);
  }
}

export class Envelope
{
  constructor(to, from, event, payload)
  {
    this._messageId = event + ':' + hashSum(Date.now() + to + payload)
    this._to = to;
    this._from = from;
    this._event = event;
    this._payload = payload;
  }

  get messageId()
  {
    return this._messageId;
  }

  get to()
  {
    return this._to;
  }

  get from()
  {
    return this._from;
  }

  get event()
  {
    return this._event;
  }

  get responseEvent()
  {
    return events.MESSAGE_RESPONSE + ':' + hashSum(this._messageId);
  }

  get payload()
  {
    return this._payload;
  }

  /**
   * @param str
   * @returns {Envelope}
   */
  static fromString(str)
  {
    return Object.assign(new this(), JSON.parse(str));
  }

  toString()
  {
    return JSON.stringify(this);
  }
}