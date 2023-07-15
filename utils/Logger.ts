import * as winston from "winston";

const LOGGER = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.File({ filename: 'combined.log' }),
		],
});

if (process.env.NODE_ENV !== 'production') {
	LOGGER.add(new winston.transports.Console({
		format: winston.format.simple(),
	}));
}

export default LOGGER;