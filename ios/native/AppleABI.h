// Minimal public Objective-C ABI declarations for an SDK-free arm64 build.
// A normal Xcode build can instead use the public Apple SDK headers.
typedef _Bool BOOL;
typedef unsigned long NSUInteger;
typedef long NSInteger;
typedef double CGFloat;
typedef struct {CGFloat x,y;} CGPoint;
typedef struct {CGFloat width,height;} CGSize;
typedef struct {CGPoint origin; CGSize size;} CGRect;
static inline CGRect CGRectMake(CGFloat x,CGFloat y,CGFloat w,CGFloat h){return (CGRect){{x,y},{w,h}};}
#define YES ((BOOL)1)
#define NO ((BOOL)0)
#define nil ((id)0)
#define NSUTF8StringEncoding 4
@class NSString,NSArray,NSDictionary,NSData,NSError,NSURL,NSURLRequest,NSHTTPURLResponse,NSHTTPCookie,WKWebView,WKNavigation,WKNavigationAction,WKFrameInfo,WKScriptMessage,WKUserContentController,UIViewController,UIWindow,UIColor,CIImage;
@protocol NSObject @end
// NSObject is a root class, but its public ABI still starts with an isa pointer.
// Omitting this slot makes direct NSObject subclass ivars overlap the object header.
__attribute__((objc_root_class)) @interface NSObject <NSObject> {
    Class isa;
}
+ (id)alloc; + (id)new; + (id)class; - (id)init; - (BOOL)isKindOfClass:(id)c;
@end
@interface NSString : NSObject
@property(readonly) NSUInteger length;
+ (id)stringWithFormat:(NSString*)format,...;
- (id)initWithData:(NSData*)d encoding:(NSUInteger)e;
+ (NSString*)stringWithContentsOfFile:(NSString*)p encoding:(NSUInteger)e error:(NSError**)err;
- (NSData*)dataUsingEncoding:(NSUInteger)e;
- (NSString*)stringByAppendingPathComponent:(NSString*)s;
- (NSString*)stringByAppendingString:(NSString*)s;
- (BOOL)isEqualToString:(NSString*)s;
- (BOOL)hasSuffix:(NSString*)s;
- (BOOL)hasPrefix:(NSString*)s;
- (NSString*)lowercaseString;
- (NSString*)description;
@end
@interface NSConstantString:NSString @end
@interface NSNumber : NSObject
+ (id)numberWithBool:(BOOL)v; + (id)numberWithInt:(int)v;
+ (id)numberWithInteger:(NSInteger)v; + (id)numberWithUnsignedInteger:(NSUInteger)v;
+ (id)numberWithDouble:(double)v; - (NSInteger)integerValue;
@end
@interface NSArray : NSObject
@property(readonly) NSUInteger count;
+ (id)arrayWithObjects:(const id[])objects count:(NSUInteger)count;
- (id)objectAtIndexedSubscript:(NSUInteger)i;
@end
@interface NSMutableArray : NSArray
- (void)addObject:(id)o;
@end
@interface NSDictionary : NSObject
+ (id)dictionaryWithObjects:(const id[])objects forKeys:(const id[])keys count:(NSUInteger)count;
- (id)objectForKeyedSubscript:(id)k;
- (void)enumerateKeysAndObjectsUsingBlock:(void(^)(id,id,BOOL*))block;
@end
@interface NSMutableDictionary : NSDictionary
- (void)setObject:(id)o forKeyedSubscript:(id)k;
@end
@interface NSNull:NSObject + (id)null; @end
@interface NSData : NSObject
@property(readonly) const void *bytes; @property(readonly) NSUInteger length;
- (NSString*)base64EncodedStringWithOptions:(NSUInteger)o;
@end
@interface NSJSONSerialization:NSObject
+ (NSData*)dataWithJSONObject:(id)o options:(NSUInteger)options error:(NSError**)e;
+ (id)JSONObjectWithData:(NSData*)data options:(NSUInteger)options error:(NSError**)e;
@end
@interface NSError:NSObject @property(readonly) NSString *localizedDescription; @end
@interface NSURL:NSObject
+ (id)URLWithString:(NSString*)s;
+ (id)fileURLWithPath:(NSString*)s;
@property(readonly) NSString *host; @property(readonly) NSString *scheme;
@property(readonly) BOOL isFileURL;
@end
@interface NSURLRequest:NSObject
+ (id)requestWithURL:(NSURL*)u;
@property(readonly) NSURL *URL;
@end
@interface NSMutableURLRequest:NSURLRequest
+ (id)requestWithURL:(NSURL*)u cachePolicy:(NSUInteger)p timeoutInterval:(double)t;
@property(copy) NSString *HTTPMethod; @property(copy) NSData *HTTPBody;
@property BOOL HTTPShouldHandleCookies;
- (void)setValue:(NSString*)s forHTTPHeaderField:(NSString*)k;
@end
@interface NSURLResponse:NSObject @property(readonly) NSURL *URL; @end
@interface NSHTTPURLResponse:NSURLResponse
@property(readonly) NSInteger statusCode; @property(readonly) NSDictionary *allHeaderFields;
@end
@interface NSHTTPCookie:NSObject
+ (NSArray*)cookiesWithResponseHeaderFields:(NSDictionary*)h forURL:(NSURL*)u;
@property(readonly) NSString *name; @property(readonly) NSString *value; @property(readonly) NSString *domain;
@end
@interface NSURLSessionConfiguration:NSObject
+ (id)ephemeralSessionConfiguration;
@property double timeoutIntervalForRequest;
@property double timeoutIntervalForResource;
@end
@interface NSURLSessionTask:NSObject - (void)resume; @end
@interface NSURLSession:NSObject
+ (id)sessionWithConfiguration:(NSURLSessionConfiguration*)c;
- (NSURLSessionTask*)dataTaskWithRequest:(NSURLRequest*)r completionHandler:(void(^)(NSData*,NSURLResponse*,NSError*))h;
@end
@interface NSOperationQueue:NSObject
+ (id)mainQueue; - (void)addOperationWithBlock:(void(^)(void))block;
@end
@interface NSBundle:NSObject + (id)mainBundle; @property(readonly) NSString *resourcePath; @end
@interface UIColor:NSObject + (id)whiteColor; @end
@interface UIView:NSObject
@property CGRect frame; @property(readonly) CGRect bounds;
@property NSUInteger autoresizingMask; @property CGFloat alpha; @property BOOL userInteractionEnabled; @property BOOL accessibilityElementsHidden; @property(strong) UIColor *backgroundColor;
- (id)initWithFrame:(CGRect)r; - (void)addSubview:(UIView*)v;
- (void)insertSubview:(UIView*)v atIndex:(NSInteger)i; - (void)removeFromSuperview;
@end
@interface UIGestureRecognizer:NSObject @property BOOL enabled; @end
@interface UIScrollView:UIView
@property(readonly) UIGestureRecognizer *pinchGestureRecognizer;
@end
@interface UINavigationItem:NSObject
@property(strong) id leftBarButtonItem; @property(strong) id rightBarButtonItem; @property(copy) NSString *title;
@end
@interface UIViewController:NSObject
@property(strong) UIView *view; @property(readonly) UINavigationItem *navigationItem;
@property NSInteger modalPresentationStyle; @property NSUInteger edgesForExtendedLayout;
- (void)viewDidLoad;
- (void)presentViewController:(UIViewController*)c animated:(BOOL)b completion:(void(^)(void))block;
- (void)dismissViewControllerAnimated:(BOOL)b completion:(void(^)(void))block;
@end
@interface UINavigationBar:UIView @property BOOL translucent; @end
@interface UINavigationController:UIViewController
@property(readonly) UINavigationBar *navigationBar;
- (id)initWithRootViewController:(UIViewController*)c; @end
@interface UIAlertAction:NSObject
+ (id)actionWithTitle:(NSString*)t style:(NSInteger)s handler:(void(^)(UIAlertAction*))h;
@end
@interface UIAlertController:UIViewController
+ (id)alertControllerWithTitle:(NSString*)title message:(NSString*)message preferredStyle:(NSInteger)style;
- (void)addAction:(UIAlertAction*)action;
@end
@interface NSTimer:NSObject
+ (id)scheduledTimerWithTimeInterval:(double)t repeats:(BOOL)r block:(void(^)(NSTimer*))b;
@end
@interface UIBarButtonItem:NSObject
- (id)initWithTitle:(NSString*)t style:(NSInteger)s target:(id)o action:(SEL)a;
@end
@interface UIWindow:UIView
@property(strong) UIViewController *rootViewController; - (void)makeKeyAndVisible;
@end
@interface UIScreen:NSObject + (UIScreen*)mainScreen; @property(readonly) CGRect bounds; @end
@protocol UIApplicationDelegate <NSObject> @end
@interface UIApplication:NSObject @end
extern int UIApplicationMain(int,char**,NSString*,NSString*);
extern NSString *NSStringFromClass(id c);
@protocol WKScriptMessageHandler <NSObject>
- (void)userContentController:(WKUserContentController*)u didReceiveScriptMessage:(WKScriptMessage*)m;
@end
@protocol WKNavigationDelegate <NSObject> @end
@interface WKUserContentController:NSObject
- (void)addScriptMessageHandler:(id<WKScriptMessageHandler>)h name:(NSString*)name;
@end
@interface WKHTTPCookieStore:NSObject - (void)getAllCookies:(void(^)(NSArray*))c;
- (void)deleteCookie:(NSHTTPCookie*)cookie completionHandler:(void(^)(void))c;
@end
@interface WKWebsiteDataStore:NSObject
+ (id)defaultDataStore; + (id)nonPersistentDataStore;
@property(readonly) WKHTTPCookieStore *httpCookieStore;
@end
@interface WKWebViewConfiguration:NSObject
@property(strong) WKUserContentController *userContentController;
@property(strong) WKWebsiteDataStore *websiteDataStore;
@end
@interface WKWebView:UIView
@property(readonly) UIScrollView *scrollView;
- (id)initWithFrame:(CGRect)r configuration:(WKWebViewConfiguration*)c;
@property(weak) id<WKNavigationDelegate> navigationDelegate;
- (id)loadHTMLString:(NSString*)html baseURL:(NSURL*)url;
- (id)loadFileURL:(NSURL*)u allowingReadAccessToURL:(NSURL*)a;
- (id)loadRequest:(NSURLRequest*)r;
- (void)evaluateJavaScript:(NSString*)s completionHandler:(void(^)(id,NSError*))h;
@property(readonly) WKWebViewConfiguration *configuration;
@end
@interface WKFrameInfo:NSObject @property(readonly) BOOL isMainFrame; @property(readonly) NSURLRequest *request; @end
@interface WKScriptMessage:NSObject
@property(readonly) id body; @property(readonly) WKFrameInfo *frameInfo;
@property(readonly) WKWebView *webView;
@end
@interface WKNavigationAction:NSObject @property(readonly) NSURLRequest *request; @end
@interface CIFilter:NSObject
+ (id)filterWithName:(NSString*)n;
- (void)setValue:(id)v forKey:(NSString*)k;
@property(readonly) CIImage *outputImage;
@end
@interface CIImage:NSObject @property(readonly) CGRect extent; @end
@interface CIContext:NSObject
+ (id)contextWithOptions:(NSDictionary*)options;
- (void*)createCGImage:(CIImage*)image fromRect:(CGRect)r;
@end
@interface UIImage:NSObject + (id)imageWithCGImage:(void*)image; @end
extern NSData *UIImagePNGRepresentation(UIImage*);
extern void CGImageRelease(void*);
typedef const void *CFTypeRef;
typedef const void *CFDictionaryRef;
extern const CFTypeRef kSecClass,kSecClassGenericPassword,kSecAttrService,kSecAttrAccount,kSecValueData,kSecReturnData,kSecMatchLimit,kSecMatchLimitOne,kSecAttrAccessible,kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
extern int SecItemAdd(CFDictionaryRef,CFTypeRef*);
extern int SecItemCopyMatching(CFDictionaryRef,CFTypeRef*);
extern int SecItemDelete(CFDictionaryRef);
extern void CFRelease(CFTypeRef);
extern unsigned char *CC_MD5(const void*,unsigned int,unsigned char*);
