import CustomEvent from 'custom-event';
import {addFrame, getFrame, Frame, getId, getTags, getAllFrames, setId, setTags, addListener} from './assets/frame';
import {Envelope, events, SetupPayload} from "./assets/messages";

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
    if(msg.data)
    {
      try
      {
        const envelope = Envelope.fromString(msg.data);
        if(envelope.event === events.LOADED && _isWindow(msg.source) && envelope.from === '?')
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
          if((!frame) && msg.origin)
          {
            const channel = new MessageChannel();
            addFrame(new Frame(frameId, frameTags, msg.origin, channel.port1));
            const readyEnvelope = new Envelope(
              frameId,
              '',
              events.SETUP,
              SetupPayload.fromObject({frameId, frameTags})
            );
            msg.source.postMessage(readyEnvelope.toString(), msg.origin, [channel.port2]);
          }
        }
      }
      catch(e)
      {
        console.log(e);
      }
    }
  });

  // listen for iframe deletions
  if(window.MutationObserver)
  {
    (new MutationObserver(
        (mutations) =>
        {
          // check for removed target
          mutations.forEach(
            (mutation) =>
            {
              Array.from(mutation.removedNodes)
                   .filter((node) => node.nodeType === Node.ELEMENT_NODE)
                   .forEach(
                     (node) =>
                     {
                       _iframesRemoved((node.matches('iframe')) ? [node] : node.querySelectorAll('iframe'));
                     });
            });
        })
    ).observe(document, {subtree: true, childList: true});
  }
  else
  {
    document.addEventListener('DOMNodeRemoved', function (e)
    {
      if(e.target.nodeType === Node.ELEMENT_NODE)
      {
        _iframesRemoved((e.target.matches('iframe')) ? [e.target] : e.target.querySelectorAll('iframe'));
      }
    });
  }

  function _iframesRemoved(iframes)
  {
    if(iframes.length)
    {
      iframes.forEach(
        (iframe) =>
        {
          if(iframe.hasAttribute('courier-id'))
          {
            const frameId = iframe.getAttribute('courier-id');
            if(frameId && _frames[frameId])
            {
              delete _frames[frameId];
            }
          }
        });
      debouncedUpdateFrames();
    }
  }

  document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: getId()}}));
}
else
{
  // frame listens to setup
  window.addEventListener('message', (msg) =>
  {
    if(msg.data)
    {
      try
      {
        const envelope = Envelope.fromString(msg.data);
        if(envelope.event === events.SETUP && _isWindow(msg.source) && msg.source === window.top)
        {
          const payload = SetupPayload.fromObject(envelope.payload);
          if(payload.frameId && payload.frameTags && envelope.from === '')
          {
            setId(payload.frameId);
            setTags(payload.frameTags);
            addFrame(new Frame('', [], msg.origin, msg.ports[0]));
          }

          // we are now set up, send READY to all top frames with our setup payload

          document.dispatchEvent(new CustomEvent('frame-courier-ready', {detail: {frameId: getId()}}));
        }
      }
      catch(e)
      {
      }
    }
  });
  const envelope = new Envelope('', '?', events.LOADED, null);
  window.top.postMessage(envelope.toString(), '*');
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
  //frames: _frames
  getFrame: getFrame,
};