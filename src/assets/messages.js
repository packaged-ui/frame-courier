import hashSum from "hash-sum";

const _EVENT_PREFIX = '_frame_courier--';
export const events = {
  LOADED: _EVENT_PREFIX + 'loaded', // iframe notifies top that it has loaded the script
  SETUP: _EVENT_PREFIX + 'setup', // iframe receives id and tags from top
  READY: _EVENT_PREFIX + 'ready', // notify another frame that is exists and is ready to receive handshake
  HANDSHAKE: _EVENT_PREFIX + 'handshake', // handshake contains a port for bidi communication
  MESSAGE_RESPONSE: _EVENT_PREFIX + 'message-response',
};

export class NegotiationPayload
{
  constructor(frameId = null, frameTags = [])
  {
    this.frameId = frameId || null;
    this.frameTags = frameTags || [];
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
    this._timestamp = Date.now();
    this._messageId = event + ':' + hashSum(this._timestamp + to + payload)
    this._to = to;
    this._from = from;
    this._event = event;
    this._payload = payload;
  }

  get messageId()
  {
    return this._messageId;
  }

  get timestamp()
  {
    return this._timestamp;
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
    try
    {
      return Object.assign(new this(), JSON.parse(str));
    }
    catch(e)
    {
    }
  }

  toString()
  {
    return JSON.stringify(this);
  }
}
