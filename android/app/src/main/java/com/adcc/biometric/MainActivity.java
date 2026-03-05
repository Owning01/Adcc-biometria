package com.adcc.biometric;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(VoiceServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
