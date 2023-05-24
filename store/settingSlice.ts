import { createSlice } from '@reduxjs/toolkit';

import { defaultSetting, Setting } from '@/types';

import { RootState } from '.';

const loadSettingFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
        const serializedSetting = localStorage.getItem('setting');
        if (serializedSetting) {
            return JSON.parse(serializedSetting);
        }
        return defaultSetting;
    }
    return null;
};

const initialState: Setting = loadSettingFromLocalStorage();

export const settingSlice = createSlice({
    name: 'setting',
    initialState,
    reducers: {
        setAppSetting: (state, action) => {
            return action.payload;
        },
        
    },
});

export const { setAppSetting } = settingSlice.actions;
export default settingSlice.reducer;
export const getApiKey = (state: RootState) => state.setting.apiKey;
export const getAppSetting = (state: RootState) => state.setting;
