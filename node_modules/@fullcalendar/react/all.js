import { jsx } from 'react/jsx-runtime';
import { C as Calendar$1 } from './chunks/c0b7e8fb.js';
import { i as interactionPlugin } from './chunks/bf188228.js';
import { d as dayGridPlugin } from './chunks/8084af4f.js';
import { t as timeGridPlugin } from './chunks/71e49b82.js';
import { l as listPlugin } from './chunks/23b48db3.js';
import { m as multiMonthPlugin } from './chunks/30c277ba.js';

const plugins = [
    interactionPlugin,
    dayGridPlugin,
    timeGridPlugin,
    listPlugin,
    multiMonthPlugin,
];
function Calendar(options = {}) {
    return (jsx(Calendar$1, { ...options, plugins: [
            ...plugins,
            ...(options.plugins || []),
        ] }));
}

export { Calendar, Calendar as default, plugins };
