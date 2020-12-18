import CustomEvent from 'custom-event';
import {addFrame, getFrame, Frame, getId, getTags, getAllFrames, setId, setTags, addListener} from './assets/frame';
import {Envelope, events, NegotiationPayload} from "./assets/messages";
import 'custom-event-polyfill';

/**
 * Send a message to a specific frame
 *
 * @param {String} frameId   ID of the frame to send the message to
 * @param {String} event
 * @param {any} [payload]      Will be serialized using JSON.stringify
 * @param {Function?}  [callback]
 */
function sendMessage(frameId, event, payload, callback)
{
  const frm = getFrame(frameId);
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

if(window === window.top)
{
  setId('');

  // top listens to LOADED
  window.addEventListener('message', (msg) =>
  {
    if(msg.data && _isWindow(msg.source))
    {
      const envelope = Envelope.fromString(msg.data);
      if(envelope.event === events.LOADED && envelope.from === '?')
      {
        const iframe = Array.from(document.querySelectorAll('iframe'))
                            .find((iframe) => iframe.contentWindow === msg.source);

        if(!iframe.hasAttribute('courier-id'))
        {
          iframe.setAttribute('courier-id', 'frame-' + _randomString());
        }
        const frameId = iframe.getAttribute('courier-id');
        const frameTags = iframe.getAttribute('courier-tags').split(/\s+/);

        const frame = getFrame(frameId);
        if(((!frame) && msg.origin) || frame.origin === msg.origin)
        {
          const channel = new MessageChannel();
          if(!_recoverFrame(frameId, msg.origin, channel.port1))
          {
            addFrame(new Frame(frameId, frameTags, msg.origin, channel.port1));
          }
          const readyEnvelope = new Envelope(
            frameId,
            '',
            events.SETUP,
            new NegotiationPayload(frameId, frameTags)
          );
          msg.source.postMessage(readyEnvelope.toString(), msg.origin, [channel.port2]);
        }
      }
    }
  });

  document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: getId()}}));
}
else
{
  // frame listens to setup
  window.addEventListener('message', (msg) =>
  {
    if(msg.data && _isWindow(msg.source))
    {
      const envelope = Envelope.fromString(msg.data);
      if(envelope.event === events.SETUP && msg.source === window.top)
      {
        const payload = NegotiationPayload.fromObject(envelope.payload);
        if(payload.frameId && payload.frameTags && envelope.from === '')
        {
          setId(payload.frameId);
          setTags(payload.frameTags);
          addFrame(new Frame('', [], msg.origin, msg.ports[0]));
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
      if(envelope.event === events.READY)
      {
        // got ready, create port, frame and handshake
        const payload = NegotiationPayload.fromObject(envelope.payload);
        if(payload.frameId && payload.frameTags && envelope.from === payload.frameId && envelope.to === '?')
        {
          const channel = new MessageChannel();
          if(!_recoverFrame(payload.frameId, msg.origin, channel.port1))
          {
            addFrame(new Frame(payload.frameId, payload.frameTags, msg.origin, channel.port1));
          }
          const handshakeEnvelope = new Envelope(
            payload.frameId,
            getId(),
            events.HANDSHAKE,
            new NegotiationPayload(getId(), getTags())
          )
          msg.source.postMessage(handshakeEnvelope.toString(), msg.origin, [channel.port2]);
        }
      }
      if(envelope.event === events.HANDSHAKE)
      {
        // got ready, create port, frame and handshake
        const payload = NegotiationPayload.fromObject(envelope.payload);
        if(payload.frameId && payload.frameTags && envelope.from === payload.frameId)
        {
          if(!_recoverFrame(payload.frameId, msg.origin, msg.ports[0]))
          {
            addFrame(new Frame(payload.frameId, payload.frameTags, msg.origin, msg.ports[0]));
          }
        }
      }
    }
  });

  // send loaded message to top
  const envelope = new Envelope('', '?', events.LOADED, null);
  window.top.postMessage(envelope.toString(), '*');
}

function _recoverFrame(id, origin, port)
{
  const existing = getFrame(id);
  if(existing && existing.origin === origin)
  {
    existing.setPort(port);
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
  return obj.window === obj;
}

export const FrameCourier = {
  send: sendMessage,
  sendToTag: sendMessageToTag,
  broadcast,
  id: getId,
  tags: getTags,
  listen: addListener,
  events: events,
  frames: getAllFrames,
};
