import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Field, reduxForm, formValueSelector } from 'redux-form'
import * as actions from '../../actions'
import { getDateFormat } from '../../selectors'
import moment from 'moment'
import { EventUpdateMethodField, EventUpdateMethods } from '../fields'
import { RelatedEvents } from '../index'
import './style.scss'
import { get, isNil } from 'lodash'

const Component = ({ handleSubmit, initialValues, relatedEvents=[], dateFormat }) => {
    let event = initialValues
    const originalEvent = event._originalEvent
    let startStr = moment(event.dates.start).format('MMMM Do YYYY, h:mm:ss a')
    let endStr = moment(event.dates.end).format('MMMM Do YYYY, h:mm:ss a')
    let showRecurring = event.recurrence_id

    const isOriginalRecurring = !isNil(get(originalEvent, 'dates.recurring_rule'))
    const isUpdatedRecurring = !isNil(get(event, 'dates.recurring_rule'))

    // Default the update_method to 'Update this event only'
    event.update_method = EventUpdateMethods[0]

    let updateMethodLabel = 'Would you like to update all recurring events or just this one?'
    let showUpdateMethod = true

    if (isOriginalRecurring && !isUpdatedRecurring) {
        // A recurring event was converted to a non-recurring one
        // Display a confirmation modal indicating the after-effects
        showRecurring = false
        showUpdateMethod = false
        updateMethodLabel = 'Only this instance of the recurrent series will be affected.'
    }

    return (
        <div className="UpdateEventConfirmation">
            <div className="metadata-view">
                <dl>
                    { event.slugline && (<dt>Slugline:</dt>) }
                    { event.slugline && (<dd>{ event.slugline }</dd>) }
                    { event.name && (<dt>Name:</dt>) }
                    { event.name && (<dd>{ event.name }</dd>) }
                    <dt>Starts:</dt>
                    <dd>{ startStr }</dd>
                    <dt>Ends:</dt>
                    <dd>{ endStr }</dd>
                    { showRecurring && (<dt>Events:</dt>)}
                    { showRecurring && (<dd>{ relatedEvents.length + 1 }</dd>)}
                </dl>
            </div>

            <form onSubmit={handleSubmit}>
                <div>
                    <span>
                        <strong>This event is a recurring event!</strong>
                    </span>

                    { showUpdateMethod ? (
                        <Field name="update_method"
                               component={EventUpdateMethodField}
                               label={updateMethodLabel}/>
                    ) : (
                        <p>{ updateMethodLabel }</p>
                    )}
                </div>
                <button type="submit" style={{ visibility: 'hidden' }}>Submit</button>
            </form>

            { showUpdateMethod && relatedEvents.length < 1 && (
                <div className="spacing" />
            )}

            { showUpdateMethod && relatedEvents.length > 0 && (
                <div>
                    <div className="sd-alert sd-alert--hollow sd-alert--alert">
                        <strong>This will also update the following events</strong>
                        <RelatedEvents
                            events={relatedEvents}
                            dateFormat={dateFormat} />
                    </div>
                </div>
            )}
        </div>
    )
}

Component.propTypes = {
    handleSubmit: PropTypes.func.isRequired,
    initialValues: PropTypes.object.isRequired,
    relatedEvents: PropTypes.array,
    dateFormat: PropTypes.string.isRequired,
}

// Decorate the form container
export const UpdateRecurringEvents = reduxForm({ form: 'updateEventConfirmation' })(Component)

const selector = formValueSelector('updateEventConfirmation')

const mapStateToProps = (state) => ({
    relatedEvents: selector(state, '_events' ),
    dateFormat: getDateFormat(state),
})

const mapDispatchToProps = (dispatch) => ({
    /** `handleSubmit` will call `onSubmit` after validation */
    onSubmit: (event) => (
        dispatch(actions.uploadFilesAndSaveEvent(event))
        .then(() => {
            if (get(event, '_publish', false)) {
                dispatch(actions.publishEvent(event._id))
            }
            dispatch(actions.hideModal())
        })
    ),
})

export const UpdateRecurringEventsForm = connect(
    mapStateToProps,
    mapDispatchToProps,
    null,
    { withRef: true }
)(UpdateRecurringEvents)
