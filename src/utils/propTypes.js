/**
 * src/utils/propTypes.js  —  v2
 * PropTypes condivisi per modali e componenti ricorrenti.
 *
 * MODIFICHE v2:
 *  - Rimosso `posti_letto` (alias legacy DB mai usato nel codice).
 *    Il campo canonico è `bed_count`.
 *  - Rimosso `type` e `city` (non presenti nel DB reale).
 *  - Aggiunto `email_direzione`, `director_sanitario`, `referente_struttura`
 *    che compaiono in FacilityModal e DirectorFacility.
 *  - `modalWithKpi` aggiunto per i modal KPI che ricevono kpiRecords + year.
 */

import PropTypes from 'prop-types';

export const modalBase = {
  isOpen:  PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export const facilityShape = PropTypes.shape({
  id:                        PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name:                      PropTypes.string,
  company_id:                PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  udo_id:                    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  bed_count:                 PropTypes.number,
  is_suspended:              PropTypes.bool,
  address:                   PropTypes.string,
  region:                    PropTypes.string,
  referent:                  PropTypes.string,
  // Contatti
  director:                  PropTypes.string,
  email_direzione:           PropTypes.string,
  director_sanitario:        PropTypes.string,
  email_sanitario:           PropTypes.string,
  referente_struttura:       PropTypes.string,
  email_referente_struttura: PropTypes.string,
  email_qualita:             PropTypes.string,
  responsabile_haccp:        PropTypes.string,
  email_responsabile_haccp:  PropTypes.string,
  // Campi calcolati da enrichFacilitiesData
  udo_color:                 PropTypes.string,
  udo_name:                  PropTypes.string,
  isGreen:                   PropTypes.bool,
  isYellow:                  PropTypes.bool,
  isRed:                     PropTypes.bool,
  isKpiGreen:                PropTypes.bool,
  clientStatus:              PropTypes.oneOf(['empty', 'pending', 'completed']),
  staffStatus:               PropTypes.oneOf(['empty', 'pending', 'completed']),
});

export const modalWithFacility = {
  ...modalBase,
  facility: facilityShape,
  onSave:   PropTypes.func,
  onDelete: PropTypes.func,
};

export const modalWithFacilities = {
  ...modalBase,
  facilities: PropTypes.arrayOf(facilityShape),
  udos:       PropTypes.array,
  surveys:    PropTypes.array,
  kpiRecords: PropTypes.array,
  year:       PropTypes.number,
};

/** Per i modal che lavorano solo su KPI (Charts, Laser, Xray, Dashboard) */
export const modalWithKpi = {
  ...modalBase,
  facilities: PropTypes.arrayOf(facilityShape).isRequired,
  kpiRecords: PropTypes.array.isRequired,
  year:       PropTypes.number.isRequired,
};
