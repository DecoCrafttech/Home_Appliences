import { CalendarController } from './public-api.js';
export { CalendarController, formatDate, formatRange, sliceEvents, version } from './public-api.js';
import { useCallback, useState } from 'react';
export { C as Calendar, C as default } from './chunks/c0b7e8fb.js';
export { J as JsonRequestError, g as globalLocales, a as globalPlugins } from './chunks/cb8ba596.js';
export { j as joinClassNames } from './chunks/470f8d8e.js';

function useCalendarController() {
    const handleDateChange = useCallback(() => {
        // controllerWrap.controller will ALWAYS contain the first and only CalendarController
        setControllerWrap({ controller: controllerWrap.controller });
    }, []);
    // wrap controller in unique object to ensure new references and rerender
    const [controllerWrap, setControllerWrap] = useState(() => ({
        controller: new CalendarController(handleDateChange)
    }));
    // TODO: destroy by ._setApi(undefined) ?
    return controllerWrap.controller;
}

export { useCalendarController };
