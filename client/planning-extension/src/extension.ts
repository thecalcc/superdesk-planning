import {
    IExtension,
    IArticle,
    IDesk,
    ISuperdesk,
    IExtensionActivationResult,
    onPublishMiddlewareResult,
} from 'superdesk-api';
import {IPlanningAssignmentService} from './interfaces';
import {IPlanningConfig} from '../../interfaces';
import {getAssignmentService} from './utils';
import {AssignmentsList} from './assignments-overview';
import {IPlanningExtensionConfigurationOptions} from './extension_configuration_options';
import {AutopostIngestRuleEditor} from './ingest_rule_autopost/AutopostIngestRuleEditor';
import {AutopostIngestRulePreview} from './ingest_rule_autopost/AutopostIngestRulePreview';
import ng from 'superdesk-core/scripts/core/services/ng';
// import {superdeskApi} from '../../../client/superdeskApi';
// import {isContentLinkToCoverageAllowed} from '../../../client/utils/archive';
import {extensionBridge} from './extension_bridge';

function onSpike(superdesk: ISuperdesk, item: IArticle) {
    const {gettext} = superdesk.localization;

    if (item.assignment_id != null) {
        return Promise.resolve({
            warnings: [
                {
                    text: gettext('This item is linked to in-progress planning coverage.'),
                },
            ],
        });
    } else {
        return Promise.resolve({});
    }
}

function onSpikeMultiple(superdesk: ISuperdesk, items: Array<IArticle>) {
    const {gettext} = superdesk.localization;
    const itemsWithAssignmentsExist = items.some((item) => item.assignment_id != null);

    if (itemsWithAssignmentsExist) {
        return Promise.resolve({
            warnings: [
                {
                    text: gettext('Some items are linked to in-progress planning coverage.'),
                },
            ],
        });
    } else {
        return Promise.resolve({});
    }
}

function onPublishArticle(superdesk: ISuperdesk, item: IArticle): Promise<onPublishMiddlewareResult> {
    if (!superdesk || !superdesk.instance || !superdesk.instance.config) {
        return Promise.resolve({});
    }

    const config: IPlanningConfig = superdesk.instance.config as IPlanningConfig;

    if (config && config.planning_check_for_assignment_on_publish) {
        const assignmentService: IPlanningAssignmentService = getAssignmentService();

        return assignmentService.onPublishFromAuthoring(item);
    }

    return Promise.resolve({});
}

function onArticleRewriteAfter(superdesk: ISuperdesk, item: IArticle): Promise<IArticle> {
    if (!superdesk || !superdesk.instance || !superdesk.instance.config) {
        return Promise.resolve(item);
    }

    const config: IPlanningConfig = superdesk.instance.config as IPlanningConfig;

    if (config && config.planning_link_updates_to_coverage) {
        const assignmentService: IPlanningAssignmentService = getAssignmentService();

        return assignmentService.onArchiveRewrite(item);
    }

    return Promise.resolve(item);
}

function onSendBefore(superdesk: ISuperdesk, items: Array<IArticle>, desk: IDesk): Promise<void> {
    if (!superdesk || !superdesk.instance || !superdesk.instance.config) {
        return Promise.resolve();
    }

    const config: IPlanningConfig = superdesk.instance.config as IPlanningConfig;

    if (!config || !config.planning_check_for_assignment_on_send) {
        return Promise.resolve();
    }

    // If the destination desk is a production desk
    // and there are items provided, then call onSendFromAuthoring
    if (desk && desk.desk_type === 'production' && items.length > 0) {
        const assignmentService: IPlanningAssignmentService = getAssignmentService();

        return assignmentService.onSendFromAuthoring(items);
    }

    return Promise.resolve();
}

const extension: IExtension = {
    activate: (superdesk: ISuperdesk) => {
        const extensionConfig: IPlanningExtensionConfigurationOptions = superdesk.getExtensionConfig();

        const displayTopbarWidget = superdesk.privileges.hasPrivilege('planning_assignments_view')
            && extensionConfig?.assignmentsTopBarWidget === true;

            const result: IExtensionActivationResult = {
                contributions: {
                    entities: {
                        article: {
                            getActions: (item: IArticle) => [{
                                label: 'Add to Planning',
                                groupId: 'planning-actions',
                                icon: 'calendar-list',
                                onTrigger: () => {
                                    const privilegesService = ng.get('privileges');
                                    const archiveService = ng.get('archiveService');
                                    const authoringService = ng.get('authoring');

                                    if (
                                        privilegesService.userHasPrivileges({planning_planning_management: 1}) &&
                                        privilegesService.userHasPrivileges({archive: 1}) &&
                                        !item.assignment_id != null &&
                                        !archiveService.isPersonal(item) &&
                                        // !superdeskApi.entities.article.isLockedInOtherSession(item) &&
                                        !['correction'].includes(item.state) &&
                                        // isContentLinkToCoverageAllowed(item) &&
                                        (
                                            authoringService.itemActions(item).edit ||
                                            authoringService.itemActions(item).correct ||
                                            authoringService.itemActions(item).deschedule
                                        )
                                    ) {
                                        const customEvent = new CustomEvent("planning:addToPlanning", {detail: item});
                                        window.dispatchEvent(customEvent)
                                    }
                                },
                            }],
                            onSpike: (item: IArticle) => onSpike(superdesk, item),
                            onSpikeMultiple: (items: Array<IArticle>) => onSpikeMultiple(superdesk, items),
                            onPublish: (item: IArticle) => onPublishArticle(superdesk, item),
                            onRewriteAfter: (item: IArticle) => onArticleRewriteAfter(superdesk, item),
                            onSendBefore: (items: Array<IArticle>, desk: IDesk) => onSendBefore(superdesk, items, desk),
                        },
                        ingest: {
                            ruleHandlers: {
                                planning_publish: {
                                    editor: AutopostIngestRuleEditor,
                                    preview: AutopostIngestRulePreview,
                                },
                            },
                        },
                    },
                    notifications: {
                        'email:notification:assignments': {name: superdesk.localization.gettext('Assignment')}
                    },
                    globalMenuHorizontal: displayTopbarWidget ? [AssignmentsList] : [],
                },
            };

        return Promise.resolve(result);
    },
};

export const registerEditorField = extensionBridge.fields.registerEditorField;

export default extension;
