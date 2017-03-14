import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Tracker } from 'meteor/tracker'

import { OHIF } from 'meteor/ohif:core';
import 'meteor/ohif:cornerstone';
import 'meteor/ohif:viewerbase';
import 'meteor/ohif:metadata';


/**
 * Inits OHIF Hanging Protocol's onReady.
 * It waits for OHIF Hanging Protocol to be ready to instantiate the ProtocolEngine
 * Hanging Protocol will use OHIF LayoutManager to render viewports properly
 */
const initHangingProtocol = () => {
    // When Hanging Protocol is ready
    HP.ProtocolStore.onReady(() => {

        // Gets all StudyMetadata objects: necessary for Hanging Protocol to access study metadata
        const studyMetadataList = OHIF.viewer.StudyMetadataList.all();

        // Caches Layout Manager: Hanging Protocol uses it for layout management according to current protocol
        const layoutManager = OHIF.viewerbase.layoutManager;

        // Instantiate StudyMetadataSource: necessary for Hanging Protocol to get study metadata
        const studyMetadataSource = new StudyList.classes.OHIFStudyMetadataSource();

        // Get prior studies map
        const studyPriorsMap = StudyList.functions.getStudyPriorsMap(studyMetadataList);

        // Creates Protocol Engine object with required arguments
        const ProtocolEngine = new HP.ProtocolEngine(layoutManager, studyMetadataList, studyPriorsMap, studyMetadataSource);

        // Sets up Hanging Protocol engine
        HP.setEngine(ProtocolEngine);

        Session.set('ViewerReady', true);

    });
};

Meteor.startup(() => {
    Session.setDefault('activeViewport', false);
    Session.setDefault('leftSidebar', false);
    Session.setDefault('rightSidebar', false);

    OHIF.viewer = OHIF.viewer || {};
    OHIF.viewer.defaultTool = 'wwwc';
    OHIF.viewer.refLinesEnabled = true;
    OHIF.viewer.cine = {
        framesPerSecond: 24,
        loop: true
    };

    const viewportUtils = OHIF.viewerbase.viewportUtils;

    OHIF.viewer.functionList = {
        toggleCineDialog: viewportUtils.toggleCineDialog,
        toggleCinePlay: viewportUtils.toggleCinePlay,
        clearTools: viewportUtils.clearTools,
        resetViewport: viewportUtils.resetViewport,
        invert: viewportUtils.invert
    };

    OHIF.viewer.stackImagePositionOffsetSynchronizer = new OHIF.viewerbase.StackImagePositionOffsetSynchronizer();

    // Create the synchronizer used to update reference lines
    OHIF.viewer.updateImageSynchronizer = new cornerstoneTools.Synchronizer('CornerstoneNewImage', cornerstoneTools.updateImageSynchronizer);

    OHIF.viewer.metadataProvider = OHIF.cornerstone.metadataProvider;

    // Metadata configuration
    const metadataProvider = OHIF.viewer.metadataProvider;
    cornerstoneTools.metaData.addProvider(metadataProvider.provider.bind(metadataProvider));
});


Template.viewer.onCreated(() => {

    Session.set('ViewerReady', false);

    const instance = Template.instance();

    instance.data.state = new ReactiveDict();
    instance.data.state.set('leftSidebar', Session.get('leftSidebar'));
    instance.data.state.set('rightSidebar', Session.get('rightSidebar'));

    const contentId = instance.data.contentId;

    if (ViewerData[contentId] && ViewerData[contentId].loadedSeriesData) {
        OHIF.log.info('Reloading previous loadedSeriesData');
        OHIF.viewer.loadedSeriesData = ViewerData[contentId].loadedSeriesData;
    } else {
        OHIF.log.info('Setting default ViewerData');
        OHIF.viewer.loadedSeriesData = {};
        ViewerData[contentId] = {};
        ViewerData[contentId].loadedSeriesData = OHIF.viewer.loadedSeriesData;

        // Update the viewer data object
        ViewerData[contentId].viewportColumns = 1;
        ViewerData[contentId].viewportRows = 1;
        ViewerData[contentId].activeViewport = 0;
    }

    Session.set('activeViewport', ViewerData[contentId].activeViewport || 0);

    // @TypeSafeStudies
    // Clears OHIF.viewer.Studies collection
    OHIF.viewer.Studies.removeAll();

    // @TypeSafeStudies
    // Clears OHIF.viewer.StudyMetadataList collection
    OHIF.viewer.StudyMetadataList.removeAll();

    ViewerData[contentId].studyInstanceUids = [];
    instance.data.studies.forEach(study => {
        const studyMetadata = new OHIF.metadata.StudyMetadata(study, study.studyInstanceUid);
        const displaySets = OHIF.viewerbase.sortingManager.getDisplaySets(studyMetadata);

        studyMetadata.setDisplaySets(displaySets);

        study.selected = true;
        study.displaySets = displaySets;
        OHIF.viewer.Studies.insert(study);
        OHIF.viewer.StudyMetadataList.insert(studyMetadata);
        ViewerData[contentId].studyInstanceUids.push(study.studyInstanceUid);
    });

    Session.set('ViewerData', ViewerData);
});

Template.viewer.onRendered(function() {

    this.autorun(function() {
        // To make sure ohif viewerMain is rendered before initializing Hanging Protocols
        const isOHIFViewerMainRendered = Session.get('OHIFViewerMainRendered');

        // To avoid first run
        if (isOHIFViewerMainRendered) {
            // To run only when OHIFViewerMainRendered dependency has changed.
            // because initHangingProtocol can have other reactive components
            Tracker.nonreactive(initHangingProtocol);
        }
    });

});

Template.viewer.events({
    'click .js-toggle-studies'() {
        const instance = Template.instance();
        const current = instance.data.state.get('leftSidebar');
        instance.data.state.set('leftSidebar', !current);
    },
    'click .js-toggle-protocol-editor'() {
        const instance = Template.instance();
        const current = instance.data.state.get('rightSidebar');
        instance.data.state.set('rightSidebar', !current);
    },
});