## FrameCourier

High level interface to window.postMessage.
This package makes it easy to send and receive secure messages cross-origin.

#### Frames
FrameCourier requires frames to be named.  This name will be used as the target of communication of `FrameCourier.sendMessage`

```html
<body>
  <iframe courier-name="myframe" src="/myframe.html"></iframe>
</body>
```

#### Listeners

```javascript
FrameCourier.addActionListener(
  'my action',
  function(payload) { alert(payload); }
);
```
#### Listeners

```javascript
FrameCourier.sendMessage(
  '',
  'my action',
  function(payload) { alert(payload); }
);
```
