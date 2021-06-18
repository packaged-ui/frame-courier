import CustomEvent from 'custom-event';
import {addFrame, addListener, Frame, getAllFrames, getId, getTags, setId, setTags} from './assets/frame';
import {Envelope, events, NegotiationPayload} from "./assets/messages";
import 'console-polyfill';

let _useChannels = true;
try
{
  if(_useChannels)
  {
    const m = new MessageChannel();
    window.postMessage('test transferable', '/', [m.port1]);
  }
}
catch(e)
{
  _useChannels = false;
}

//noinspection JSUnusedGlobalSymbols
export function disableChannels()
{
  _useChannels = false;
}

function _tryPostMessageTransfer(target, message, origin, transfer)
{
  try
  {
    if(_useChannels && transfer)
    {
      return target.postMessage(message, origin, transfer);
    }
  }
  catch(e)
  {
  }
  return target.postMessage(message, origin);
}

/**
 * Send a message to a specific frame
 *
 * @param {String} frameId   ID of the frame to send the message to
 * @param {String} event
 * @param {any} [payload]      Will be serialized using JSON.stringify
 * @param {Function}  [callback]
 */
function sendMessage(frameId, event, payload, callback)
{
  const frm = getAllFrames().get(frameId);
  if(frm)
  {
    frm.send(event, payload, callback);
  }
  else
  {
    throw {message: 'frame does not exist', data: frameId};
  }
}

function sendMessageToTag(tag, event, payload, callback)
{
  getAllFrames().forEach(
    frame =>
    {
      if(frame.tags.indexOf(tag) > -1)
      {
        frame.send(event, payload, callback);
      }
    });
}

function broadcast(event, payload, callback)
{
  getAllFrames().forEach(
    frame =>
    {
      if(frame.id !== getId())
      {
        frame.send(event, payload, callback);
      }
    });
}

if(_isTop())
{
  setId('');

  // top listens to LOADED
  window.addEventListener('message', (msg) =>
  {
    if(!msg.data || !msg.source || !_isWindow(msg.source))
    {
      return;
    }
    const envelope = Envelope.fromString(msg.data);
    if(!envelope)
    {
      return;
    }
    if(envelope.event === events.LOADED && envelope.from === '?')
    {
      const iframe = Array.from(document.querySelectorAll('iframe'))
                          .find((iframe) => iframe.contentWindow === msg.source);

      if(!iframe.hasAttribute('courier-id'))
      {
        iframe.setAttribute('courier-id', 'frame-' + _randomString());
      }
      const frameId = iframe.getAttribute('courier-id');
      const frameTags = (iframe.getAttribute('courier-tags') || '').split(/\s+/);

      const frame = getAllFrames().get(frameId);
      if(((!frame) && msg.origin) || frame.origin === msg.origin)
      {
        if(!_shouldReplacePort(frameId, envelope.timestamp))
        {
          return;
        }

        let sendPort = msg.source;
        let recvPort = null;
        if(_useChannels)
        {
          const channel = new MessageChannel();
          sendPort = channel.port1;
          recvPort = channel.port2;
        }
        if(!_recoverFrame(frameId, msg.origin, sendPort))
        {
          addFrame(new Frame(frameId, frameTags, msg.origin, sendPort));
        }
        const readyEnvelope = new Envelope(frameId, '', events.SETUP, new NegotiationPayload(frameId, frameTags));

        _setPortTime(readyEnvelope.to, readyEnvelope.timestamp);
        _tryPostMessageTransfer(msg.source, readyEnvelope.toString(), msg.origin, [recvPort]);
      }
    }
  });

  document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: getId()}}));
}
else
{
  const _delayReady = [];

  // frame listens to setup
  window.addEventListener('message', (msg) =>
  {
    if(!msg.data || !msg.source || !_isWindow(msg.source))
    {
      return;
    }
    const envelope = Envelope.fromString(msg.data);
    if(!envelope)
    {
      return;
    }
    if(envelope.event === events.SETUP && msg.source === window.top)
    {
      const payload = NegotiationPayload.fromObject(envelope.payload);
      if(payload.frameId && payload.frameTags && envelope.from === '')
      {
        setId(payload.frameId);
        setTags(payload.frameTags);
        addFrame(new Frame('', [], msg.origin, _useChannels ? msg.ports[0] : msg.source));

        // play delayed ready messages
        while(_delayReady.length > 0)
        {
          _handleReady(...(_delayReady.shift()));
        }

        // we are now set up, send READY to all other top frames with our setup payload
        for(let i = 0; i < window.top.frames.length; i++)
        {
          if(window.top.frames[i] !== window)
          {
            const readyEnvelope = new Envelope('?', getId(), events.READY, payload);
            window.top.frames[i].postMessage(readyEnvelope.toString(), '*');
          }
        }

        document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: getId()}}));
      }
    }
    if(envelope.event === events.READY)
    {
      if(getId())
      {
        return _handleReady(msg, envelope);
      }
      // delay incoming ready events until we have an id
      _delayReady.push([msg, envelope]);
    }
    if(envelope.event === events.HANDSHAKE)
    {
      // got handshake, create port, frame and handshake
      const payload = NegotiationPayload.fromObject(envelope.payload);
      if(payload.frameId && payload.frameTags && envelope.from === payload.frameId)
      {
        if(!_shouldReplacePort(envelope.from, envelope.timestamp))
        {
          return;
        }

        if(!_recoverFrame(payload.frameId, msg.origin, _useChannels ? msg.ports[0] : msg.source))
        {
          addFrame(new Frame(
            payload.frameId,
            payload.frameTags,
            msg.origin,
            _useChannels ? msg.ports[0] : msg.source
          ));
        }
      }
    }
  });

  /**
   * @param {MessageEvent} msg
   * @param {Envelope} envelope
   * @private
   */
  function _handleReady(msg, envelope)
  {
    // got ready, create port, frame and handshake
    const payload = NegotiationPayload.fromObject(envelope.payload);
    if(payload.frameId && payload.frameTags && envelope.from === payload.frameId && envelope.to === '?')
    {
      if(!_shouldReplacePort(envelope.from, envelope.timestamp))
      {
        return;
      }

      let sendPort = msg.source;
      let recvPort = null;
      if(_useChannels)
      {
        const channel = new MessageChannel();
        sendPort = channel.port1;
        recvPort = channel.port2;
      }
      if(!_recoverFrame(payload.frameId, msg.origin, sendPort))
      {
        addFrame(new Frame(payload.frameId, payload.frameTags, msg.origin, sendPort));
      }
      const handshakeEnvelope = new Envelope(
        payload.frameId,
        getId(),
        events.HANDSHAKE,
        new NegotiationPayload(getId(), getTags())
      );

      _setPortTime(handshakeEnvelope.to, handshakeEnvelope.timestamp);
      _tryPostMessageTransfer(msg.source, handshakeEnvelope.toString(), msg.origin, [recvPort]);
    }
  }

  // send loaded message to top
  const envelope = new Envelope('', '?', events.LOADED, null);
  window.top.postMessage(envelope.toString(), '*');
}

function _recoverFrame(id, origin, port)
{
  const existing = getAllFrames().get(id);
  if(existing)
  {
    if(existing.origin === origin)
    {
      existing.setPort(port);
    }
    return true;
  }
  return false;
}

function _randomString()
{
  return parseInt(Math.random().toFixed(16).slice(2, 19)).toString(36);
}

function _isWindow(obj)
{
  try
  {
    return obj.window === obj;
  }
  catch(e)
  {
    return false;
  }
}

function _isTop()
{
  try
  {
    return window.self === window.top;
  }
  catch(e)
  {
    return false;
  }
}

const _ports = new Map();

function _shouldReplacePort(frameId, portCreatedTime)
{
  if(_ports.has(frameId))
  {
    const portTime = _ports.get(frameId);
    if(portCreatedTime > portTime)
    {
      // older port wins
      return false;
    }

    if(portCreatedTime === portTime && frameId > getId())
    {
      // earlier id (alphabetically) wins
      return false;
    }
  }

  _setPortTime(frameId, portCreatedTime);
  return true;
}

function _setPortTime(frameId, portCreatedTime)
{
  _ports.set(frameId, portCreatedTime);
}

//noinspection JSUnusedGlobalSymbols
export const FrameCourier = {
  send: sendMessage,
  sendToTag: sendMessageToTag,
  broadcast: broadcast,
  id: getId,
  tags: getTags,
  listen: addListener,
  events: events,
  get frames() { return getAllFrames(); },
};
