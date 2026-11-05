setFieldComponentConfig('#附件UUID_61b30ed2-6e12-4e51-9339-52ca4e20143a#', {
  getPreviewUrl: async (attachment) => {
    const bucketName = attachment?.bucketName;
    const storageCode = attachment?.storageCode;
    const fileUrl = attachment?.attachment?.fileUrl;
    if (typeof fileUrl !== 'string' || !fileUrl) return undefined;
    // 获取当前用户信息
    const userInfo = getUserInfo();
    // 获取文件服务后端路由
    const hzerofileRoute = window.__env__.HZERO_HFLE;
    // 获取当前环境网关地址
    const apiHost = window.__env__.API_HOST;
    // 获取当前用户token
    const accessToken = utils.getAccessToken();
    // H0插件预览接口地址
    const previewUrl = `${apiHost}${hzerofileRoute}/v1/${userInfo.organizationId}/file-preview/by-url?storageCode=${storageCode}&bucketName=${bucketName}&url=${encodeURIComponent(fileUrl)}&access_token=${accessToken}`;
    // 根据文件名后缀区分不同处理
    if (fileUrl.endsWith('png')) {
      // H0附件加签接口地址
      const requestUrl = `${apiHost}${hzerofileRoute}/v1/${userInfo.organizationId}/files/signedUrl?storageCode=${storageCode}&bucketName=${bucketName}&url=${encodeURIComponent(fileUrl)}&access_token=${accessToken}`;
      let signedUrl = fileUrl;
      try {
        signedUrl = await axios({
          url: requestUrl,
          method: 'GET',
        });
      } catch (error) {
        console.error('获取加签地址报错:', error);
      }
      return signedUrl;
    } else {
      return previewUrl;
    }
  },
  getDownloadUrl: ({ attachment }) => {
    const bucketName = attachment?.bucketName;
    const fileUrl = attachment?.fileUrl;
    // 获取当前用户信息
    const userInfo = getUserInfo();
    // 获取文件服务后端路由
    const hzerofileRoute = window.__env__.HZERO_HFLE;
    // 获取当前环境网关地址
    const apiHost = window.__env__.API_HOST;
    // 获取当前用户token
    const accessToken = utils.getAccessToken();
    // 替换为H0内网下载地址，解决跨域访问、内网访问等类似问题
    const downloadUrl = `${apiHost}${hzerofileRoute}/v1/${userInfo.organizationId}/files/download-by-url?bucketName=${bucketName}&url=${encodeURIComponent(fileUrl)}&access_token=${accessToken}`;
    return downloadUrl;
  },
});
