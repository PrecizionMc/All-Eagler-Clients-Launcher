// Pixel's bundled launcher waits for a startup log absent from these builds.
const bundle = document.querySelectorAll('script.client_bundle');
const frame = document.getElementById('game_frame');
const overlay = document.getElementById('launch-container');
if (bundle.length === 1 && frame && overlay && document.getElementById('selector')
    && typeof window.launchVersion === 'function' && typeof window.showGame === 'function') {
  const observer = new MutationObserver(() => reveal());
  const reveal = () => {
    if (!frame.querySelector('canvas, ._eaglercraftX_crash_element')) return;
    observer.disconnect();
    frame.style.opacity = '1';
    // Keep log targets mounted until the wrapper's own completion callback runs.
    document.querySelectorAll('.launch-remove').forEach(element => {
      element.style.setProperty('display', 'none', 'important');
    });
  };
  observer.observe(frame, { childList: true, subtree: true });
  window.launchVersion(bundle[0]).catch(error => {
    observer.disconnect();
    console.error('Unable to start the bundled Pixel client', error);
    document.getElementById('detail').textContent = `Unable to start this client: ${error.message}. Return to the library and retry.`;
  });
}
