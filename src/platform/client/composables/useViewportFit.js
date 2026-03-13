import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from "vue";

export function useViewportFit(options = {}) {
  const {
    minScale = 0.78
  } = options;

  const viewportRef = ref(null);
  const contentRef = ref(null);
  const scale = ref(1);
  const contentWidth = ref(0);
  const contentHeight = ref(0);
  const stageWidth = ref(0);
  const stageHeight = ref(0);
  const targetWidth = ref(0);
  const targetHeight = ref(0);

  let resizeObserver = null;
  let rafId = 0;

  function cancelScheduledMeasure() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function measure() {
    rafId = 0;
    const viewport = viewportRef.value;
    const content = contentRef.value;
    if (!viewport || !content) return;

    const availableWidth = Math.floor(viewport.clientWidth);
    const availableHeight = Math.floor(viewport.clientHeight);
    const nextContentWidth = Math.ceil(Math.max(content.scrollWidth, content.offsetWidth, content.clientWidth));
    const nextContentHeight = Math.ceil(Math.max(content.scrollHeight, content.offsetHeight, content.clientHeight));

    if (!availableWidth || !availableHeight || !nextContentWidth || !nextContentHeight) return;

    const widthRatio = availableWidth / nextContentWidth;
    const heightRatio = availableHeight / nextContentHeight;
    const nextScale = Math.max(minScale, Math.min(widthRatio, heightRatio, 1));

    contentWidth.value = nextContentWidth;
    contentHeight.value = nextContentHeight;
    scale.value = nextScale;
    stageWidth.value = Math.min(availableWidth, Math.ceil(nextContentWidth * nextScale));
    stageHeight.value = Math.min(availableHeight, Math.ceil(nextContentHeight * nextScale));
    targetWidth.value = Math.floor(availableWidth / nextScale);
    targetHeight.value = Math.floor(availableHeight / nextScale);
  }

  function scheduleMeasure() {
    cancelScheduledMeasure();
    rafId = requestAnimationFrame(() => {
      measure();
    });
  }

  onMounted(() => {
    resizeObserver = new ResizeObserver(() => {
      scheduleMeasure();
    });
    if (viewportRef.value) {
      resizeObserver.observe(viewportRef.value);
    }
    if (contentRef.value) {
      resizeObserver.observe(contentRef.value);
    }
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();
  });

  onUpdated(() => {
    scheduleMeasure();
  });

  onBeforeUnmount(() => {
    cancelScheduledMeasure();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", scheduleMeasure);
  });

  const stageStyle = computed(() => ({
    "--route-fit-stage-width": stageWidth.value ? `${stageWidth.value}px` : "100%",
    "--route-fit-stage-height": stageHeight.value ? `${stageHeight.value}px` : "100%",
    "--route-fit-content-width": contentWidth.value ? `${contentWidth.value}px` : "100%",
    "--route-fit-content-height": contentHeight.value ? `${contentHeight.value}px` : "auto",
    "--route-fit-target-width": targetWidth.value ? `${targetWidth.value}px` : "100%",
    "--route-fit-target-height": targetHeight.value ? `${targetHeight.value}px` : "100%",
    "--route-fit-scale": String(scale.value)
  }));

  return {
    viewportRef,
    contentRef,
    stageStyle,
    scale,
    scheduleMeasure
  };
}
