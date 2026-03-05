package com.adcc.biometric;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

@CapacitorPlugin(name = "VoiceServicePlugin")
public class VoiceServicePlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VoiceForegroundService.class);
        serviceIntent.putExtra("inputExtra", "Escuchando...");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VoiceForegroundService.class);
        context.stopService(serviceIntent);
        call.resolve();
    }
}
