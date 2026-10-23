#ifdef MSQ_USE_SDK
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <CoreImage/CoreImage.h>
#import <Security/Security.h>
#import <CommonCrypto/CommonDigest.h>
#import <CommonCrypto/CommonCryptor.h>
#else
#import "AppleABI.h"
#endif
static NSString *JSON(id value) {
    NSData *d=[NSJSONSerialization dataWithJSONObject:value options:0 error:0];
    return d?[[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding]:@"null";
}
static BOOL AllowedURL(NSURL *url) {
    if(![[url scheme] isEqualToString:@"https"]) return NO;
    NSString *h=[[url host] lowercaseString];
    NSArray *hosts=@[@"h5api.m.taobao.com",@"lop-proxy.jd.com",@"mec.yto.net.cn",@"yizhan.mamayz.com",@"mcs-mimp-web.sf-express.com",@"ant.yshoufa.com",@"mobile.yangkeduo.com",@"api.pinduoduo.com"];
    for(NSUInteger i=0;i<hosts.count;i++) if([h isEqualToString:hosts[i]]) return YES;
    return NO;
}
@interface MSQController:UIViewController <WKScriptMessageHandler,WKNavigationDelegate>
@property(strong) WKWebView *web;
@property(strong) WKWebView *loginWeb;
@property(strong) WKWebView *antiWeb;
@property(strong) id antiRequestID;
@property(strong) UIViewController *loginController;
@property(strong) NSString *loginPlatform;
@property(strong) id loginRequestID;
@property(strong) NSURLSession *session;
@property(strong) NSDictionary *pddCryptoSession;
@end
@implementation MSQController
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor=[UIColor whiteColor];
    WKWebViewConfiguration *c=[WKWebViewConfiguration new];
    c.websiteDataStore=[WKWebsiteDataStore nonPersistentDataStore];
    [c.userContentController addScriptMessageHandler:self name:@"bridge"];
    self.web=[[WKWebView alloc] initWithFrame:self.view.bounds configuration:c];
    self.web.autoresizingMask=18;
    self.web.scrollView.pinchGestureRecognizer.enabled=NO;
    self.web.navigationDelegate=self;
    [self.view addSubview:self.web];
    NSString *root=[[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"web"];
    [self.web loadFileURL:[NSURL fileURLWithPath:[root stringByAppendingPathComponent:@"index.html"]] allowingReadAccessToURL:[NSURL fileURLWithPath:root]];
    NSURLSessionConfiguration *sc=[NSURLSessionConfiguration ephemeralSessionConfiguration];
    sc.timeoutIntervalForRequest=25;
    sc.timeoutIntervalForResource=45;
    self.session=[NSURLSession sessionWithConfiguration:sc];
}
- (void)webView:(WKWebView*)web decidePolicyForNavigationAction:(WKNavigationAction*)action decisionHandler:(void(^)(NSInteger))handler {
    NSURL *url=action.request.URL;
    // The privileged local webview never navigates to remote pages.
    if(web==self.web) handler(url.isFileURL?1:0);
    else handler([[url scheme] isEqualToString:@"https"]?1:0);
}
- (void)webView:(WKWebView*)web didFailNavigation:(WKNavigation*)navigation withError:(NSError*)error {
    if(web==self.antiWeb && self.antiRequestID) {
        [self reply:self.antiRequestID value:nil error:@"拼多多校验页面加载失败（PDD-ANTI-LOAD）"];
        [self.antiWeb removeFromSuperview]; self.antiWeb=nil; self.antiRequestID=nil;
    }
}
- (void)webView:(WKWebView*)web didFailProvisionalNavigation:(WKNavigation*)navigation withError:(NSError*)error {
    [self webView:web didFailNavigation:navigation withError:error];
}
- (void)reply:(id)rid value:(id)value error:(NSString*)error {
    NSDictionary *r=@{@"id":rid?:@0,@"value":value?:[NSNull null],@"error":error?:[NSNull null]};
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
        [self.web evaluateJavaScript:[@"window.nativeReply(" stringByAppendingString:[JSON(r) stringByAppendingString:@")"]] completionHandler:0];
    }];
}
- (NSDictionary*)keyQuery {
    return @{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecAttrService:@"ink.mashangqu.ios",(__bridge id)kSecAttrAccount:@"credentials-v1"};
}
- (void)userContentController:(WKUserContentController*)u didReceiveScriptMessage:(WKScriptMessage*)m {
    if(m.webView==self.antiWeb && m.frameInfo.isMainFrame) {
        id rid=self.antiRequestID;
        if([m.body isKindOfClass:[NSDictionary class]]) {
            NSDictionary *result=m.body;
            NSString *value=result[@"value"];
            if([value isKindOfClass:[NSString class]] && value.length>50) [self reply:rid value:value error:nil];
            else {
                NSString *reason=[result[@"error"] isEqualToString:@"timeout"]?@"PDD-ANTI-TIMEOUT":@"PDD-ANTI-SCRIPT";
                [self reply:rid value:nil error:[@"拼多多校验未完成（" stringByAppendingString:[reason stringByAppendingString:@"），请重试"]]];
            }
        } else [self reply:rid value:nil error:@"拼多多校验模块响应异常"];
        [self.antiWeb removeFromSuperview]; self.antiWeb=nil; self.antiRequestID=nil; return;
    }
    if(m.webView!=self.web||!m.frameInfo.isMainFrame||!m.frameInfo.request.URL.isFileURL) return;
    if(![m.body isKindOfClass:[NSDictionary class]]) return;
    NSDictionary *p=m.body; id rid=p[@"id"]; NSString *op=p[@"op"]; NSDictionary *a=p[@"args"];
    if(![a isKindOfClass:[NSDictionary class]]) { [self reply:rid value:nil error:@"请求格式错误"]; return; }
    if([op isEqualToString:@"load"]) {
        NSMutableDictionary *q=[NSMutableDictionary new];
        [[self keyQuery] enumerateKeysAndObjectsUsingBlock:^(id k,id v,BOOL *stop){q[k]=v;}];
        q[(__bridge id)kSecReturnData]=@YES; q[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;
        CFTypeRef result=0; int status=SecItemCopyMatching((__bridge CFDictionaryRef)q,&result);
        if(status==0&&result) {
            NSData *d=(__bridge NSData*)result;
            id o=[NSJSONSerialization JSONObjectWithData:d options:0 error:0];
            [self reply:rid value:o?:[NSDictionary new] error:nil]; CFRelease(result);
        } else [self reply:rid value:[NSDictionary new] error:status==-25300?nil:@"钥匙串读取失败，请检查自签权限"];
    } else if([op isEqualToString:@"save"]) {
        id data=a[@"data"];
        if(![data isKindOfClass:[NSDictionary class]]) { [self reply:rid value:nil error:@"保存数据格式错误"]; return; }
        NSData *d=[NSJSONSerialization dataWithJSONObject:data options:0 error:0];
        if(!d) { [self reply:rid value:nil error:@"数据编码失败"]; return; }
        NSMutableDictionary *q=[NSMutableDictionary new];
        [[self keyQuery] enumerateKeysAndObjectsUsingBlock:^(id k,id v,BOOL *stop){q[k]=v;}];
        // Update first: a failed write must not destroy a previously working login.
        extern int SecItemUpdate(CFDictionaryRef,CFDictionaryRef);
        NSDictionary *attrs=@{(__bridge id)kSecValueData:d};
        int status=SecItemUpdate((__bridge CFDictionaryRef)q,(__bridge CFDictionaryRef)attrs);
        if(status==-25300) {
            q[(__bridge id)kSecValueData]=d;
            q[(__bridge id)kSecAttrAccessible]=(__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
            status=SecItemAdd((__bridge CFDictionaryRef)q,0);
        }
        [self reply:rid value:@(status==0) error:status==0?nil:@"钥匙串保存失败，请检查自签权限"];
    } else if([op isEqualToString:@"md5"]) {
        NSString *s=a[@"text"]; if(![s isKindOfClass:[NSString class]]) return;
        NSData *d=[s dataUsingEncoding:NSUTF8StringEncoding]; unsigned char hash[16]; CC_MD5(d.bytes,(unsigned int)d.length,hash);
        NSString *out=@"";
        for(int i=0;i<16;i++) out=[out stringByAppendingString:[NSString stringWithFormat:@"%02x",(unsigned int)hash[i]]];
        [self reply:rid value:out error:nil];
    } else if([op isEqualToString:@"pddCrypto"]) {
        NSString *action=a[@"action"],*sid=a[@"session"];
        if([action isEqualToString:@"clear"]) {
            if([sid isKindOfClass:[NSString class]] && [sid isEqualToString:self.pddCryptoSession[@"id"]])self.pddCryptoSession=nil;
            [self reply:rid value:@YES error:nil];return;
        }
        if([action isEqualToString:@"new"]) {
            unsigned char random[48];
            if(SecRandomCopyBytes(kSecRandomDefault,48,random)!=0){[self reply:rid value:nil error:@"无法生成安全随机数"];return;}
            const char *alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            unsigned char chars[48];for(int i=0;i<48;i++)chars[i]=alphabet[random[i]&63];
            NSData *key=[NSData dataWithBytes:chars length:16],*iv=[NSData dataWithBytes:chars+16 length:16];
            NSString *identifier=[[NSString alloc] initWithData:[NSData dataWithBytes:chars+32 length:16] encoding:NSUTF8StringEncoding];
            NSData *der=[[NSData alloc] initWithBase64EncodedString:@"MIIBCgKCAQEAtfMuf2KsVE4WwYU2bMTXQ6KMbSPZRkiGJTChqYQJDta1nGyPBMSHQkXybJaTyAha5eNqQR0p12nCIQ/+3+MwJUgS2IxVnpYYrpRf1K0Zf+jkwUi0OfPCd+eLOLkAWHWcjqw+Z8em60s7dmUJcbymtuQfx0Q3pAEuzkENiwrRlMG1zdi+2JFnAnSk+IqqRDg2GjhKXKiepturJ+eTSluC79WFTRFIAxlVcurFCQjJM1pSO4GtDFr6jlDGJrQDll8mIs84vdIkaoB7VS1zRNbuGm4wpOOzpKlMbKdsOpZ4JjlSH/kdPAwHYVDxF97h424KNeilCsGkZWhtrRq3B4WSwQIDAQAB" options:0];
            NSDictionary *attributes=@{(__bridge id)kSecAttrKeyType:(__bridge id)kSecAttrKeyTypeRSA,(__bridge id)kSecAttrKeyClass:(__bridge id)kSecAttrKeyClassPublic,(__bridge id)kSecAttrKeySizeInBits:@2048};
            SecKeyRef rsa=SecKeyCreateWithData((__bridge CFDataRef)der,(__bridge CFDictionaryRef)attributes,0);
            if(!rsa){[self reply:rid value:nil error:@"无法创建验证加密密钥"];return;}
            CFDataRef encKey=SecKeyCreateEncryptedData(rsa,kSecKeyAlgorithmRSAEncryptionPKCS1,(__bridge CFDataRef)key,0);
            CFDataRef encIV=SecKeyCreateEncryptedData(rsa,kSecKeyAlgorithmRSAEncryptionPKCS1,(__bridge CFDataRef)iv,0);
            CFRelease(rsa);
            if(!encKey||!encIV){if(encKey)CFRelease(encKey);if(encIV)CFRelease(encIV);[self reply:rid value:nil error:@"验证密钥交换失败"];return;}
            NSString *key64=[(__bridge NSData*)encKey base64EncodedStringWithOptions:0],*iv64=[(__bridge NSData*)encIV base64EncodedStringWithOptions:0];
            CFRelease(encKey);CFRelease(encIV);
            self.pddCryptoSession=@{@"id":identifier,@"key":key,@"iv":iv};
            [self reply:rid value:@{@"session":identifier,@"a":key64,@"v":iv64} error:nil];return;
        }
        NSDictionary *session=self.pddCryptoSession;
        if(![sid isKindOfClass:[NSString class]]||![sid isEqualToString:session[@"id"]]){[self reply:rid value:nil error:@"验证会话已失效，请重新扫码"];return;}
        BOOL encrypt=[action isEqualToString:@"encrypt"];
        if(!encrypt&&![action isEqualToString:@"decrypt"]){[self reply:rid value:nil error:@"无效的验证加密操作"];return;}
        NSData *input=nil;
        if(encrypt && [a[@"data"] isKindOfClass:[NSDictionary class]])input=[JSON(a[@"data"]) dataUsingEncoding:NSUTF8StringEncoding];
        else if(!encrypt && [a[@"content"] isKindOfClass:[NSString class]] && [a[@"content"] length]<128*1024)input=[[NSData alloc] initWithBase64EncodedString:a[@"content"] options:0];
        if(!input||input.length>64*1024){[self reply:rid value:nil error:@"验证加密数据格式无效"];return;}
        NSData *key=session[@"key"],*iv=session[@"iv"];
        NSMutableData *output=[NSMutableData dataWithLength:input.length+16];NSUInteger written=0;
        int result=CCCrypt(encrypt?0:1,0,1,key.bytes,16,iv.bytes,input.bytes,input.length,output.mutableBytes,output.length,&written);
        if(result!=0){[self reply:rid value:nil error:@"验证数据加解密失败"];return;}
        output.length=written;
        if(encrypt)[self reply:rid value:[output base64EncodedStringWithOptions:0] error:nil];
        else {
            id json=[NSJSONSerialization JSONObjectWithData:output options:0 error:0];
            [self reply:rid value:json error:json?nil:@"验证响应解析失败"];
        }
    } else if(([op isEqualToString:@"code"] || [op isEqualToString:@"shareCode"])) {
        NSString *s=a[@"text"]; if(![s isKindOfClass:[NSString class]]||s.length>2500) { [self reply:rid value:nil error:@"码内容无效"]; return; }
        BOOL bar=[a[@"type"] isEqualToString:@"BARCODE"];
        CIFilter *f=[CIFilter filterWithName:bar?@"CICode128BarcodeGenerator":@"CIQRCodeGenerator"];
        [f setValue:[s dataUsingEncoding:NSUTF8StringEncoding] forKey:@"inputMessage"];
        if(!bar) [f setValue:@"M" forKey:@"inputCorrectionLevel"];
        CIImage *image=f.outputImage;
        if(!image) { [self reply:rid value:nil error:@"无法生成码图，请检查码内容"]; return; }
        void *cg=[[CIContext contextWithOptions:nil] createCGImage:image fromRect:image.extent];
        if(!cg) { [self reply:rid value:nil error:@"无法绘制码图"]; return; }
        UIImage *rendered=[UIImage imageWithCGImage:cg]; CGImageRelease(cg);
        if([op isEqualToString:@"shareCode"]) {
            // A white quiet zone and nearest-neighbour scale make the saved QR scannable.
            UIGraphicsBeginImageContextWithOptions((CGSize){640,640},YES,1);
            [[UIColor whiteColor] setFill]; UIRectFill(CGRectMake(0,0,640,640));
            CGContextSetInterpolationQuality(UIGraphicsGetCurrentContext(),1);
            [rendered drawInRect:CGRectMake(40,40,560,560)];
            UIImage *shared=UIGraphicsGetImageFromCurrentImageContext(); UIGraphicsEndImageContext();
            if(!shared){[self reply:rid value:nil error:@"无法生成分享图片，请截屏保存二维码"];return;}
            UIActivityViewController *activity=[[UIActivityViewController alloc] initWithActivityItems:@[shared] applicationActivities:nil];
            activity.popoverPresentationController.sourceView=self.view;
            activity.popoverPresentationController.sourceRect=CGRectMake(self.view.bounds.size.width/2,self.view.bounds.size.height/2,1,1);
            activity.completionWithItemsHandler=^(NSString *type,BOOL completed,NSArray *items,NSError *error){
                [self reply:rid value:@(completed) error:error?error.localizedDescription:nil];
            };
            [self presentViewController:activity animated:YES completion:0];
        } else {
            NSData *png=UIImagePNGRepresentation(rendered);
            [self reply:rid value:[@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]] error:nil];
        }
    } else if([op isEqualToString:@"anti"]) {
        if(self.antiRequestID){[self reply:rid value:nil error:@"校验模块正在运行，请稍后再试"];return;}
        NSString *path=[[[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"web"] stringByAppendingPathComponent:@"pdd.js"];
        NSString *script=[NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:0];
        if(!script){[self reply:rid value:nil error:@"校验模块文件缺失"];return;}
        WKWebViewConfiguration *c=[WKWebViewConfiguration new];
        c.websiteDataStore=[WKWebsiteDataStore nonPersistentDataStore];
        [c.userContentController addScriptMessageHandler:self name:@"anti"];
        self.antiWeb=[[WKWebView alloc] initWithFrame:CGRectMake(0,0,393,852) configuration:c];
        self.antiRequestID=rid;
        self.antiWeb.navigationDelegate=self;
        // WebKit can suspend detached pages; keep the worker in the view hierarchy
        // behind the opaque main page, with no user or accessibility interaction.
        self.antiWeb.userInteractionEnabled=NO;
        self.antiWeb.accessibilityElementsHidden=YES;
        [self.view insertSubview:self.antiWeb atIndex:0];
        WKWebView *worker=self.antiWeb;
        [NSTimer scheduledTimerWithTimeInterval:20 repeats:NO block:^(NSTimer *timer){
            if(self.antiWeb==worker && self.antiRequestID==rid) {
                [self reply:rid value:nil error:@"拼多多校验运行超时（PDD-ANTI-TIMEOUT），请重试"];
                [worker removeFromSuperview]; self.antiWeb=nil; self.antiRequestID=nil;
            }
        }];
        NSString *js=JSON(@[a[@"serverTime"]?:@"0"]);
        NSString *html=[NSString stringWithFormat:@"<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; script-src 'unsafe-inline'; img-src data:; style-src 'unsafe-inline'\"></head><body><script>%@;var done=false;function send(v){if(done)return;done=true;window.webkit.messageHandlers.anti.postMessage(v);}setTimeout(function(){send({error:'timeout'});},15000);Promise.resolve().then(function(){return PddAnti(%@[0]);}).then(function(v){send({value:v});},function(){send({error:'generation'});});</script></body></html>",script,js];
        [self.antiWeb loadHTMLString:html baseURL:[NSURL URLWithString:@"https://mdkd.pinduoduo.com/weixin/package"]];
    } else if([op isEqualToString:@"http"]) {
        NSString *s=a[@"url"]; if(![s isKindOfClass:[NSString class]]) return;
        NSURL *url=[NSURL URLWithString:s];
        if(!url||!AllowedURL(url)) { [self reply:rid value:nil error:@"不允许访问这个地址"]; return; }
        NSMutableURLRequest *r=[NSMutableURLRequest requestWithURL:url cachePolicy:1 timeoutInterval:25];
        NSString *method=a[@"method"];
        r.HTTPMethod=[method isEqualToString:@"POST"]?@"POST":@"GET";
        r.HTTPShouldHandleCookies=NO;
        NSDictionary *headers=a[@"headers"];
        [r setValue:@"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" forHTTPHeaderField:@"User-Agent"];
        if([headers isKindOfClass:[NSDictionary class]]) [headers enumerateKeysAndObjectsUsingBlock:^(id k,id v,BOOL *stop){
            if([k isKindOfClass:[NSString class]]&&[v isKindOfClass:[NSString class]]) [r setValue:v forHTTPHeaderField:k];
        }];
        if([a[@"body"] isKindOfClass:[NSString class]]) r.HTTPBody=[a[@"body"] dataUsingEncoding:NSUTF8StringEncoding];
        [[self.session dataTaskWithRequest:r completionHandler:^(NSData *data,NSURLResponse *response,NSError *e){
            if(e) { [self reply:rid value:nil error:e.localizedDescription]; return; }
            NSHTTPURLResponse *h=(NSHTTPURLResponse*)response;
            if(data.length>8*1024*1024) { [self reply:rid value:nil error:@"响应内容过大"]; return; }
            NSMutableArray *cookies=[NSMutableArray new];
            NSArray *cs=[NSHTTPCookie cookiesWithResponseHeaderFields:h.allHeaderFields forURL:h.URL];
            for(NSUInteger i=0;i<cs.count;i++){NSHTTPCookie *c=cs[i];[cookies addObject:@{@"name":c.name,@"value":c.value,@"domain":c.domain}];}
            NSString *text=data?[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]:@"";
            [self reply:rid value:@{@"status":@(h.statusCode),@"body":text?:@"",@"cookies":cookies,@"headers":h.allHeaderFields?:[NSDictionary new]} error:nil];
        }] resume];
    } else if([op isEqualToString:@"login"]) {
        if(self.loginRequestID){[self reply:rid value:nil error:@"已有登录窗口"];return;}
        NSDictionary *urls=@{@"TAOBAO":@"https://login.m.taobao.com/login.htm",@"JD":@"https://plogin.m.jd.com/login/login",@"PDD":@"https://mobile.yangkeduo.com/login.html",@"SF":@"https://mcs-mimp-web.sf-express.com/login"};
        NSString *platform=a[@"platform"]; NSString *entry=urls[platform];
        if(!entry) { [self reply:rid value:nil error:@"此平台请使用短信登录"]; return; }
        if(a[@"url"]) {
            NSString *custom=a[@"url"];
            NSURL *verify=[custom isKindOfClass:[NSString class]]?[NSURL URLWithString:custom]:nil;
            if(![platform isEqualToString:@"PDD"] || ![[verify scheme] isEqualToString:@"https"] || ![[verify host] isEqualToString:@"mobile.yangkeduo.com"] || ![[verify path] isEqualToString:@"/psnl_verification.html"]) {
                [self reply:rid value:nil error:@"无效的拼多多验证页面"];return;
            }
            entry=custom;
        }
        self.loginRequestID=rid; self.loginPlatform=platform;
        BOOL useSafeLoginLayout=[platform isEqualToString:@"PDD"] || [platform isEqualToString:@"JD"] || [platform isEqualToString:@"SF"];
        WKWebViewConfiguration *c=[WKWebViewConfiguration new];
        c.websiteDataStore=[WKWebsiteDataStore nonPersistentDataStore];
        self.loginController=[UIViewController new];
        if(useSafeLoginLayout) self.loginController.edgesForExtendedLayout=0;
        self.loginController.navigationItem.title=@"平台网页登录";
        self.loginController.navigationItem.leftBarButtonItem=[[UIBarButtonItem alloc] initWithTitle:@"取消" style:0 target:self action:@selector(cancelLogin)];
        self.loginController.navigationItem.rightBarButtonItem=[[UIBarButtonItem alloc] initWithTitle:@"完成登录" style:2 target:self action:@selector(finishLogin)];
        self.loginWeb=[[WKWebView alloc] initWithFrame:self.loginController.view.bounds configuration:c];
        self.loginWeb.autoresizingMask=18; self.loginWeb.navigationDelegate=self;
        if(useSafeLoginLayout) self.loginController.view=self.loginWeb;
        else [self.loginController.view addSubview:self.loginWeb];
        [self.loginWeb loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:entry]]];
        UINavigationController *nav=[[UINavigationController alloc] initWithRootViewController:self.loginController];
        if(useSafeLoginLayout) nav.navigationBar.translucent=NO;
        nav.modalPresentationStyle=0;
        [self presentViewController:nav animated:YES completion:0];
    } else [self reply:rid value:nil error:@"未知操作"];
}
- (void)cancelLogin {
    [self reply:self.loginRequestID value:nil error:@"已取消登录"];
    self.loginRequestID=nil;
    [self dismissViewControllerAnimated:YES completion:^{self.loginWeb=nil;self.loginController=nil;}];
}
- (void)finishLogin {
    [self.loginWeb.configuration.websiteDataStore.httpCookieStore getAllCookies:^(NSArray *cookies){
        NSMutableDictionary *out=[NSMutableDictionary new];
        NSString *p=self.loginPlatform;
        NSArray *domains=[p isEqualToString:@"TAOBAO"]?@[@"taobao.com",@"tmall.com"]:[p isEqualToString:@"JD"]?@[@"jd.com"]:[p isEqualToString:@"PDD"]?@[@"yangkeduo.com",@"pinduoduo.com"]:@[@"sf-express.com"];
        for(NSUInteger i=0;i<cookies.count;i++) {
            NSHTTPCookie *c=cookies[i];
            for(NSUInteger j=0;j<domains.count;j++) {
                NSString *d=domains[j];
                if([c.domain isEqualToString:d]||[c.domain hasSuffix:[@"." stringByAppendingString:d]]) out[c.name]=c.value;
            }
        }
        if([p isEqualToString:@"PDD"] && !out[@"PDDAccessToken"] && !out[@"pdd_access_token"] && !out[@"accesstoken"]) {
            UIAlertController *alert=[UIAlertController alertControllerWithTitle:@"尚未完成登录" message:@"还没有取得拼多多登录凭据。请在网页中完成验证码和登录后，再点「完成登录」。" preferredStyle:1];
            [alert addAction:[UIAlertAction actionWithTitle:@"继续登录" style:0 handler:0]];
            [self.loginController presentViewController:alert animated:YES completion:0]; return;
        }
        [self reply:self.loginRequestID value:out error:nil]; self.loginRequestID=nil;
        [self dismissViewControllerAnimated:YES completion:^{self.loginWeb=nil;self.loginController=nil;}];
    }];
}
@end
@interface MSQDelegate:NSObject <UIApplicationDelegate>
@property(strong) UIWindow *window;
@end
@implementation MSQDelegate
- (BOOL)application:(UIApplication*)application didFinishLaunchingWithOptions:(NSDictionary*)options {
    self.window=[[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.window.rootViewController=[MSQController new];
    [self.window makeKeyAndVisible]; return YES;
}
@end
int main(int argc,char **argv) {
    @autoreleasepool {return UIApplicationMain(argc,argv,nil,NSStringFromClass([MSQDelegate class]));}
}
