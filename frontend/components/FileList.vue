<template>
  <section class="panel" aria-labelledby="files-title">
    <div class="panel-head">
      <h2 id="files-title">فایل‌ها</h2>
      <button type="button" class="btn-ghost" :disabled="loading" @click="loadFiles">
        {{ loading ? 'در حال بروزرسانی…' : 'بروزرسانی' }}
      </button>
    </div>

    <p v-if="listError" class="mt-[0.85rem] text-[0.9rem] text-danger">{{ listError }}</p>

    <div v-if="!files.length && !loading" class="py-2 text-[0.92rem] text-muted">
      هنوز فایلی نیست. از بخش بالا یک فایل آپلود کنید.
    </div>

    <ul v-else class="m-0 flex list-none flex-col gap-[0.55rem] p-0">
      <li
        v-for="file in files"
        :key="file.key"
        class="flex flex-col items-stretch justify-between gap-4 rounded-[10px] border border-line bg-bg-2 px-[0.85rem] py-3 sm:flex-row sm:items-center"
      >
        <div class="flex min-w-0 flex-col gap-1">
          <span class="truncate font-semibold" :title="file.key">{{ displayName(file.key) }}</span>
          <span class="truncate text-xs text-muted">
            <code class="font-mono text-[0.72rem]" dir="ltr">{{ file.key }}</code>
            · {{ formatBytes(file.size) }}
            · {{ formatDate(file.lastModified) }}
          </span>
        </div>
        <div class="flex shrink-0 gap-[0.45rem] sm:justify-start [&>.btn]:flex-1 [&>.btn]:text-center sm:[&>.btn]:flex-none">
          <a class="btn" :href="downloadUrl(file.key)" download>دانلود</a>
          <button type="button" class="btn btn-danger" @click="removeFile(file.key)">
            حذف
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { FetchError } from 'ofetch';
import type { ApiErrorBody, FilesListResponse, StoredFile } from '~/types/api';

const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const files = ref<StoredFile[]>([]);
const loading = ref(false);
const listError = ref('');

function downloadUrl(key: string) {
  return `${apiBase}/files/${encodeURIComponent(key)}/download`;
}

function errorMessage(err: unknown, fallback: string) {
  const fetchErr = err as FetchError<ApiErrorBody>;
  return fetchErr?.data?.error || fetchErr?.message || fallback;
}

async function loadFiles() {
  loading.value = true;
  listError.value = '';
  try {
    const data = await $fetch<FilesListResponse>(`${apiBase}/files`);
    files.value = data.files || [];
  } catch (err) {
    listError.value = errorMessage(err, 'بارگذاری لیست فایل‌ها ناموفق بود');
  } finally {
    loading.value = false;
  }
}

async function removeFile(key: string) {
  const name = displayName(key);
  if (!confirm(`آیا از حذف «${name}» مطمئن هستید؟`)) return;
  try {
    await $fetch(`${apiBase}/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
    await loadFiles();
  } catch (err) {
    listError.value = errorMessage(err, 'حذف فایل ناموفق بود');
  }
}

defineExpose({ loadFiles });

onMounted(() => {
  loadFiles();
});
</script>
