<template>
  <main>
    <HeroHeader />
    <FileUpload @uploaded="onUploaded" />
    <FileList ref="fileList" />
  </main>
</template>

<script setup lang="ts">
const fileList = ref<{ loadFiles: () => Promise<void> } | null>(null);

function onUploaded() {
  fileList.value?.loadFiles();
}
</script>
