import type { TripEvidence } from '../domain/types'

interface EvidencePanelProps {
    evidence: TripEvidence
}

const stateLabels: Record<TripEvidence['state'], string> = {
    observed: 'הנסיעה נצפתה',
    'not-observed': 'נסיעת היעד לא נצפתה',
    'feed-gap': 'נתוני GPS חלקיים',
    'not-gps-verifiable': 'לא ניתן לאימות ב-GPS',
}

export function EvidencePanel({ evidence }: EvidencePanelProps) {
    return (
        <section className={`evidence-panel evidence-${evidence.state}`}>
            <div className="evidence-title">
                <span aria-hidden="true" />
                <div>
                    <small>מצב ראיות</small>
                    <strong>{stateLabels[evidence.state]}</strong>
                </div>
            </div>
            <p>{evidence.explanation}</p>
            <dl>
                {evidence.maxGapMinutes !== null && (
                    <div>
                        <dt>פער GPS מרבי</dt>
                        <dd>{evidence.maxGapMinutes.toFixed(1)} דק׳</dd>
                    </div>
                )}
                {evidence.interruptions.length > 0 && (
                    <div>
                        <dt>קטיעות ברצף</dt>
                        <dd>{evidence.interruptions.length}</dd>
                    </div>
                )}
                {evidence.stalls.length > 0 && (
                    <div>
                        <dt>עצירות ממושכות</dt>
                        <dd>{evidence.stalls.length}</dd>
                    </div>
                )}
                {evidence.targetVehicleCount > 1 && (
                    <div>
                        <dt>כלי רכב בנסיעת היעד</dt>
                        <dd>{evidence.targetVehicleCount}</dd>
                    </div>
                )}
                {evidence.sustainedDeviationCount > 0 && (
                    <div>
                        <dt>חשד לסטייה מתמשכת*</dt>
                        <dd>{evidence.sustainedDeviationCount}</dd>
                    </div>
                )}
                {evidence.followingRides.length > 0 && (
                    <div>
                        <dt>נסיעות מאוחרות שנצפו</dt>
                        <dd>{evidence.followingRides.length}</dd>
                    </div>
                )}
            </dl>
            {evidence.sustainedDeviationCount > 0 && (
                <small className="evidence-caveat">
                    * לפי מסדרון משוער המחבר בין התחנות, לא לפי צורת GTFS רשמית.
                </small>
            )}
            {(evidence.originObservationMissing ||
                evidence.destinationObservationMissing) && (
                    <small className="evidence-caveat">
                        {!evidence.originObservationMissing && 'תחנת המוצא זוהתה. '}
                        {evidence.originObservationMissing &&
                            'אין תצפית מאומתת בתחנת המוצא. '}
                        {evidence.destinationObservationMissing &&
                            'אין תצפית מאומתת בתחנת היעד.'}
                    </small>
                )}
        </section>
    )
}
