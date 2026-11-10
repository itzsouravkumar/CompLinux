import { get } from '@vercel/blob';
import { createPrivateDownload } from '../lib/private-download.mjs';

export default {
  fetch: createPrivateDownload(async (key) => {
    const blob = await get(key, { access: 'private', useCache: false });
    return blob?.statusCode === 200 ? blob : null;
  }, () => process.env.PRIVATE_READ_TOKEN),
};
