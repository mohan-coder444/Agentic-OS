import proxy from "express-http-proxy";

export const proxyWithHeader = (serviceUrl) =>
  proxy(serviceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/chat/, "") || "/",
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user?.userId) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      }
      return proxyReqOpts;
    },
  });
