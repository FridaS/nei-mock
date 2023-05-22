export interface NeiMockConfig {
    /**
     * nei项目的唯一标识
     */
    key: string | Record<string, string>;
    /**
     * 项目内mock数据存放地址
     */
    localMockData: string;
    /**
     * mock数据线上地址
     */
    domain: string;
    /**
     * 需要被代理请求前缀标识
     */
    proxyURL: string[];
    /**
     * 设定可用代理后台地址
     */
    proxyTarget: Record<string, string>;
    /**
     * 强制刷新nei-mock
     */
    forceUpdate?: 're-select' | 'use-current-selection' | false;
    /**
     * mixed mode 下指定部分走代理的api: [path, target]
     */
    mixedProxy?: Record<string, string>;
}