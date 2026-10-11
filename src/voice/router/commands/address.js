/** Street addresses, typed or spoken, with or without a verb in front. */
import { analyseAddress, stripAddressLead } from '../places.js';
import { replies } from '../replies.js';

export const address = {
  id: 'address',
  patterns: [],
  // LAST resort: only reached when no command above matched. It works on the raw text because
  // normalise() drops the commas and capitals that make an address recognisable.
  match: (_norm, raw, { names }) => {
    const hit = analyseAddress(stripAddressLead(raw, names));
    return hit ? { place: hit.address, spoken: hit.spoken } : null;
  },
  handler: (a, args) => a.flyToPlace(args.place),
  speak: replies.address,
};
