'use client';

import { useCallback, useEffect, useRef } from 'react';

const PLAYER_SCRIPT_ID = 'luci-movi-player';
const PLAYER_SCRIPT_SRC = '/vendor/movi-player/element.slim.js';
let playerScriptPromise;

function loadPlayerScript() {
  if (customElements.get('movi-player')) return Promise.resolve();
  if (playerScriptPromise) return playerScriptPromise;

  playerScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(PLAYER_SCRIPT_ID);
    const script = existing || document.createElement('script');

    const loaded = () => customElements.whenDefined('movi-player').then(resolve, reject);
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', () => reject(new Error('The MKV player could not be loaded.')), { once: true });

    if (!existing) {
      script.id = PLAYER_SCRIPT_ID;
      script.type = 'module';
      script.src = PLAYER_SCRIPT_SRC;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    playerScriptPromise = null;
    throw error;
  });

  return playerScriptPromise;
}

export default function MkvPlayer({
  mediaRef,
  src,
  poster,
  title,
  resumeAt = 0,
  playbackRate = 1,
  subtitle,
  onTimeUpdate,
  onPause,
  onFailure,
}) {
  const elementRef = useRef(null);
  const callbacksRef = useRef({ onTimeUpdate, onPause, onFailure });
  callbacksRef.current = { onTimeUpdate, onPause, onFailure };

  const rememberElement = useCallback((element) => {
    elementRef.current = element;
    mediaRef.current = element;
  }, [mediaRef]);

  useEffect(() => {
    loadPlayerScript().catch((error) => callbacksRef.current.onFailure(error.message));
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const currentDuration = () => Number(element.duration) || 0;
    const handleTimeUpdate = (event) => callbacksRef.current.onTimeUpdate(
      Number(event.detail) || Number(element.currentTime) || 0,
      currentDuration(),
    );
    const handlePause = () => callbacksRef.current.onPause(
      Number(element.currentTime) || 0,
      currentDuration(),
    );
    const handleError = (event) => callbacksRef.current.onFailure(
      event.detail?.message || event.detail?.title || event.detail?.toString?.() || 'The MKV decoder could not open this source.',
    );

    element.addEventListener('timeupdate', handleTimeUpdate);
    element.addEventListener('pause', handlePause);
    element.addEventListener('error', handleError);
    element.addEventListener('errordisplay', handleError);

    return () => {
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('pause', handlePause);
      element.removeEventListener('error', handleError);
      element.removeEventListener('errordisplay', handleError);
      if (mediaRef.current === element) mediaRef.current = null;
    };
  }, [mediaRef, src]);

  return (
    <movi-player
      ref={rememberElement}
      src={src}
      poster={poster || undefined}
      title={title}
      controls=""
      autoplay=""
      muted=""
      playsinline=""
      preload="metadata"
      engine="wasm"
      sw="auto"
      buffersize="64"
      fastseek="buttons keys gestures"
      playbackrate={playbackRate}
      startat={resumeAt > 8 ? resumeAt : undefined}
      theme="dark"
      themecolor="#e50914"
      wasmurl="/vendor/movi-player/movi.wasm"
      noerrorscreen=""
    >
      {subtitle?.url && (
        <track
          src={subtitle.url}
          kind="subtitles"
          srcLang="en"
          label={subtitle.name || 'Custom'}
          data-default=""
        />
      )}
    </movi-player>
  );
}
