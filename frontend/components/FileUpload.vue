<template>
  <section class="panel" aria-labelledby="upload-title">
    <div class="panel-head">
      <h2 id="upload-title">آپلود</h2>
      <span class="font-mono text-[0.8rem] text-muted" dir="ltr">Streaming multipart → S3</span>
    </div>

    <label
      class="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-[0.35rem] rounded-xl border-[1.5px] border-dashed border-accent/45 bg-bg-2/70 p-5 transition-[border-color,background,transform] duration-200 hover:-translate-y-px hover:border-accent hover:bg-accent/10"
      :class="{
        '-translate-y-px border-accent bg-accent/10': dragging,
        'pointer-events-none cursor-progress': uploading,
      }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        class="sr-only"
        :disabled="uploading"
        @change="onFilePicked"
      />
      <template v-if="!uploading">
        <strong class="text-[1.05rem]">فایل را اینجا رها کنید</strong>
        <span class="text-[0.9rem] text-muted">یا برای انتخاب کلیک کنید</span>
      </template>
      <template v-else>
        <strong class="text-[1.05rem]">در حال آپلود… <span dir="ltr">{{ progressLabel }}</span></strong>
        <div
          class="mt-3 h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-bg-0"
          dir="ltr"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <i
            class="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-150 ease-out"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </template>
    </label>

    <p v-if="uploadError" class="mt-[0.85rem] text-[0.9rem] text-danger" role="alert">
      {{ uploadError }}
    </p>
    <p v-if="uploadOk" class="mt-[0.85rem] text-[0.9rem] text-ok">{{ uploadOk }}</p>
  </section>
</template>

<script setup lang="ts">
import type { UploadSuccessResponse } from '~/types/api';

const emit = defineEmits<{
  uploaded: [];
}>();

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const uploading = ref(false);
const progress = ref(0);
const progressLabel = ref('0%');
const uploadError = ref('');
const uploadOk = ref('');
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function onDrop(e: DragEvent) {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) uploadFile(file);
}

function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadFile(file);
  input.value = '';
}

function uploadFile(file: File) {
  uploadError.value = '';
  uploadOk.value = '';
  uploading.value = true;
  progress.value = 0;
  progressLabel.value = '0%';

  const form = new FormData();
  form.append('file', file, file.name);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${apiBase}/files/upload`);

  xhr.upload.onprogress = (evt) => {
    if (!evt.lengthComputable) return;
    const pct = Math.round((evt.loaded / evt.total) * 100);
    progress.value = pct;
    progressLabel.value = `${pct}% · ${formatBytes(evt.loaded)} / ${formatBytes(evt.total)}`;
  };

  xhr.onload = () => {
    uploading.value = false;
    try {
      const body = JSON.parse(xhr.responseText || '{}') as UploadSuccessResponse & {
        error?: string;
      };
      if (xhr.status >= 200 && xhr.status < 300) {
        const name = body.file?.originalName || file.name;
        uploadOk.value = `فایل «${name}» با موفقیت آپلود شد`;
        emit('uploaded');
      } else {
        uploadError.value = translateApiError(body.error) || `آپلود ناموفق بود (${xhr.status})`;
      }
    } catch {
      uploadError.value = `آپلود ناموفق بود (${xhr.status})`;
    }
  };

  xhr.onerror = () => {
    uploading.value = false;
    uploadError.value = 'خطای شبکه هنگام آپلود';
  };

  xhr.send(form);
}

function translateApiError(message?: string) {
  if (!message) return '';
  if (/too many requests|rate limit/i.test(message)) {
    return 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.';
  }
  if (/too large|size limit/i.test(message)) {
    return 'حجم فایل بیش از حد مجاز است.';
  }
  if (/multipart|file field|filename/i.test(message)) {
    return 'درخواست آپلود نامعتبر است. لطفاً یک فایل معتبر انتخاب کنید.';
  }
  return message;
}
</script>
