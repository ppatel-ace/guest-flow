#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BrotherPrintPlugin, "BrotherPrint",
    CAP_PLUGIN_METHOD(printLabel, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getPairedPrinters, CAPPluginReturnPromise);
)
