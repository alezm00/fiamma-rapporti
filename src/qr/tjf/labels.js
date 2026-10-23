// Tabelle del formato TJF: canali conosciuti (etichette in italiano, ordine, decimali), unità e nomi dei campi.

// L'ordine dell'array è l'ordine con cui i valori vengono mostrati.
// "re" viene confrontata con measType, type.name e type.xmlid del canale.
export const CHANNELS = [
    { id: 'TF', label: 'Temperatura fumi', short: 'TF', dec: 1, re: /^(FT|T_Flue)$|flue.?gas.?temp/i },
    { id: 'TA', label: 'Temperatura aria comburente', short: 'TA', dec: 1, re: /^(AT|T_Air)$|ambient.?temp|air.?temp/i },
    { id: 'O2', label: 'Ossigeno', short: 'O₂', dec: 1, re: /^O2$|oxygen/i },
    { id: 'CO2', label: 'Anidride carbonica', short: 'CO₂', dec: 1, re: /^CO2$|carbon.?dioxid/i },
    { id: 'uCO', label: 'CO non diluito', short: 'COnd', dec: 0, re: /^(uCO|CO_Norm|COunv)$|undilut/i },
    { id: 'COamb', label: 'CO ambiente', short: 'COamb', dec: 0, re: /ambient.?co\b|co.?ambient/i },
    { id: 'CO', label: 'Monossido di carbonio', short: 'CO', dec: 0, re: /^(CO|CO_Dil)$|carbon.?monoxid/i },
    { id: 'eta', label: 'Rendimento', short: 'η', dec: 1, re: /^(Eff[gn]?|Efficiency)$|efficien/i },
    { id: 'qA', label: 'Perdite fumi', short: 'qA', dec: 1, re: /^qA|flue.?gas.?loss|^loss/i },
    { id: 'lambda', label: "Eccesso d'aria", short: 'λ', dec: 2, re: /^(λ|Lambda)$|excess.?air|lambda/i },
    { id: 'NOx', label: 'Ossidi di azoto', short: 'NOx', dec: 0, re: /^NOx$|nox/i },
    { id: 'NO2', label: 'Biossido di azoto', short: 'NO₂', dec: 0, re: /^NO2$|nitrogen.?dioxid/i },
    { id: 'NO', label: 'Monossido di azoto', short: 'NO', dec: 0, re: /^(NO|NO_Dil)$|nitrogen.?monoxid/i },
    { id: 'draught', label: 'Tiraggio', short: 'Tir.', re: /draught|draft/i },
    { id: 'dew', label: 'Temperatura di rugiada', short: 'Trug', dec: 1, re: /dew/i },
    { id: 'dP', label: 'Pressione differenziale', short: 'ΔP', re: /differential.?pressure|^dP$/i },
    { id: 'P', label: 'Pressione', short: 'P', re: /pressure/i },
    { id: 'Tinst', label: 'Temperatura strumento', short: 'T str.', dec: 1, re: /^(Itemp|GT)$|instrument.?temp|internal.?temp/i },
];

export const PRESSURE_PA = { Pa: 1, hPa: 100, mbar: 100, kPa: 1000, bar: 1e5, MPa: 1e6, psi: 6894.757, inH2O: 249.0889, mmH2O: 9.80665, inHg: 3386.39, mmHg: 133.322 };
export const PRESSURE_DEC = { Pa: 1, hPa: 2, mbar: 2, kPa: 3, bar: 3, MPa: 4, psi: 3, inH2O: 3, mmH2O: 1, inHg: 3, mmHg: 1 };

// Nomi delle statistiche presenti in values[].description (formato testo 400 / 330 nuovo)
export const STAT_LABELS = {
    TotalMean: 'Media', TotalMinimum: 'Min', TotalMaximum: 'Max',
    Mean: 'Media', Minimum: 'Min', Maximum: 'Max', Current: 'Attuale',
};

export const PROP_LABELS = {
    Fuel: 'Combustibile', CurrentFuelName: 'Combustibile', CurrentFuelId: 'ID combustibile',
    O2Ref: 'O₂ rif.', 'O₂-Bezug': 'O₂ rif.', CO2Max: 'CO₂ max',
    MeasurementType: 'Modalità misura', MeasCycle: 'Ciclo di misura', ProbeProblem: 'Problemi sonda',
    measurementuuid: 'ID misura', appVersion: 'Versione app', note: 'Note',
    startTime: 'Inizio', endTime: 'Fine', deviceTime: 'Ora strumento',
    stabilisationTime: 'Tempo di stabilizzazione', testTime: 'Durata prova',
};
export const PROP_UNITS = { O2Ref: '%', 'O₂-Bezug': '%', CO2Max: '%' };
export const VALUE_LABELS = { Continuous: 'Continua', NoProblem: 'Nessuno', true: 'Sì', false: 'No' };

export const DEVICE_LABELS = {
    name: 'Strumento', serial: 'N. di serie', deviceIdentifier: 'Identificativo', partNumber: 'Codice',
    firmwareVersion: 'Firmware', softwareVersion: 'Software', lastServiceDate: 'Ultima assistenza',
    measCycle: 'Ciclo di misura (ms)', boardIndex: 'Modulo',
};
export const CONTACT_LABELS = {
    name: 'Nome', personOfContact: 'Referente', street: 'Via', houseNumber: 'N. civico', postalCode: 'CAP',
    city: 'Città', country: 'Paese', phone: 'Telefono', fax: 'Fax', email: 'Email', homepage: 'Sito web',
};
export const POINT_LABELS = {
    name: 'Nome', systemNumber: 'N. impianto', systemType: 'Tipo impianto', systemManufacturer: 'Costruttore',
    systemSerial: 'Matricola', yearOfConstruction: 'Anno di costruzione', notes: 'Note',
};
export const APPENDIX_LABELS = {
    smokeNumber1: 'Bacharach 1', smokeNumber2: 'Bacharach 2', smokeNumber3: 'Bacharach 3',
    calculatedSmokeNumber: 'Bacharach medio', smokePumpId: 'Pompa fumi', isOilDerivative: 'Derivati olio',
    heatCarrierTemperature: 'Temperatura vettore termico',
    gasAmount: 'Quantità gas', heatingValue: 'Potere calorifico', duration: 'Durata (s)', gasFlowRate: 'Portata gas',
    burnerCapacityNet: 'Potenza bruciatore (netta)', burnerCapacityGross: 'Potenza bruciatore (lorda)',
    flowRate: 'Portata olio', oilPressure: 'Pressione olio', burnerCapacity: 'Potenza bruciatore',
};
export const APPENDIX_TITLES = { smokeNumber: 'Indice di fumo', gasFlow: 'Portata gas', oilFlow: 'Portata olio' };
export const ERROR_LABELS = {
    TjfError_NoMeasurementsAvailable: 'Nessun risultato di misura disponibile',
    TjfError_NoMeasurementDeviceConnected: 'Nessuno strumento di misura collegato',
};
export const KNOWN_KEYS = new Set([
    '$schema', 'schemaVersion', 'channels', 'device', 'customer', 'organisation', 'organization', 'measuringPoint',
    'properties', 'results', 'timeStamp', 'type', 'additionalMeasurementInformation', 'images', 'snapshots',
    'appendix', 'errors',
]);
