/** Library
 * Moment.js  = key : MHMchiX6c1bwSqGM1PZiW_PxhMjh3Sh48
 */
/**
 * @OnlyCurrentDoc
 */


Logger.log('Google Apps Script on...');



function onInstall(e) {
  onOpen(e);
}


function onOpen(e) {
  Logger.log('AuthMode: ' + e.authMode);
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  if(e && e.authMode == 'NONE'){
    menu.addItem('Getting Started', 'askEnabled');
  } else {
    var memo = PropertiesService.getDocumentProperties();
    var lang = Session.getActiveUserLocale();
    memo.setProperty('lang', lang);
    var sidebar_text = lang === 'ja' ? 'サイドバーの表示' : 'Show Sidebar';
    var createChart_text = lang === 'ja' ? 'ガントチャートの作成' : 'Create Gantt Chart';
    menu.addItem(createChart_text, 'createChart');
    menu.addItem(sidebar_text, 'showSidebar');
  };
  menu.addToUi();
};


function onEdit(e) {
  Logger.log('onEdit start');
  var schedule = getScheduleSheet();
  var holiday = getHolidaySheet();
  if (e.source.getActiveSheet().getName() == 'schedule') {
    Logger.log('for the schedule sheet');
    var memo = PropertiesService.getDocumentProperties();
    var editedRow = e.range.getRow();
    var editedColumn = e.range.getColumn();
    var lastColumn = e.range.getLastColumn();
    var lastRow = e.range.getLastRow();
    var lastRowOfContents = schedule.getLastRow();
    var selectedItem = schedule.getRange(2, editedColumn).getValue();
    var baseLine = findStartPoint('progress')+1;
    var baseDate = Moment.moment(schedule.getRange(1, baseLine).getValue());
    var baseRange = schedule.getRange(1, 1, lastRowOfContents, baseLine-1);
    var baseData = baseRange.getValues();

    //nothing happens if you edit the first and second row
    if(editedRow === 1 || editedRow === 2){
     return;
   };

   if (selectedItem === 'plannedStart' || selectedItem === 'plannedFinish' || selectedItem === 'actualStart' || selectedItem === 'actualFinish' || selectedItem === 'progress') {
    Logger.log('start or finish is edited');
    //paint parents' bar if true
    var memo = PropertiesService.getDocumentProperties();
    var isParentChart = memo.getProperty('ParentChart') == 'true' ? true : false;
    Logger.log('isParentChart: ' + isParentChart);
    if(isParentChart){
      if(selectedItem === 'plannedStart' || selectedItem === 'plannedFinish'){
        Logger.log('show parents\' bar');
        var formulas = baseRange.getFormulas();
        var indexOfPlannedStart = baseData[1].indexOf('plannedStart');
        var indexOfPlannedFinish = baseData[1].indexOf('plannedFinish');
        if(editedRow === lastRow){
          Logger.log('the number of target is one');
          var parentTasks = findParentTasks(baseData, baseData[editedRow-1][0]);
          updateChart(baseData, editedRow, lastRow, baseLine, baseDate, parentTasks);
          var newData = makeParentChart(baseData, formulas, indexOfPlannedStart, indexOfPlannedFinish, parentTasks, baseDate, baseLine);
          for (var i = 0, len = parentTasks.length; i < len; i++){
            var values = [[newData[parentTasks[i]['index']][indexOfPlannedStart], newData[parentTasks[i]['index']][indexOfPlannedFinish]]];
            schedule.getRange(parentTasks[i]['index']+1, indexOfPlannedStart+1, 1, 2).setValues(values);
          };
        } else {
          Logger.log('the number of target is more than one');
          var parentTasks = findParentTasks(baseData);
          updateChart(baseData, editedRow, lastRow, baseLine, baseDate, parentTasks);
          var newData = makeParentChart(baseData, formulas, indexOfPlannedStart, indexOfPlannedFinish, parentTasks, baseDate, baseLine);
          baseRange.setValues(newData);
        };
      } else {
        updateChart(baseData, editedRow, lastRow, baseLine, baseDate);
      };
    } else {
      updateChart(baseData, editedRow, lastRow, baseLine, baseDate);
    };
  };

  if(selectedItem === 'progress' || selectedItem === 'plannedWorkload'){
    Logger.log('calculate workload and progress');
    var indexOfPlannedWorkload = baseData[1].indexOf('plannedWorkload');
    var indexOfProgress = baseData[1].indexOf('progress');
    var formulas = baseRange.getFormulas();
    if(editedRow === lastRow){
      Logger.log('the number of target is one');
      var parentTasks = findParentTasks(baseData, baseData[editedRow-1][0]);
      var newData = sumTwoColumns(baseData, formulas, indexOfPlannedWorkload, indexOfProgress, parentTasks, baseDate);
      for (var i = 0, len = parentTasks.length; i < len; i++){
        schedule.getRange(parentTasks[i]['index']+1, indexOfPlannedWorkload+1).setValue(newData[parentTasks[i]['index']][indexOfPlannedWorkload]);
        schedule.getRange(parentTasks[i]['index']+1, indexOfProgress+1).setValue(newData[parentTasks[i]['index']][indexOfProgress]);
      };
    } else {
      Logger.log('the number of target is more than one');
      var parentTasks = findParentTasks(baseData);
      var newData = sumTwoColumns(baseData, formulas, indexOfPlannedWorkload, indexOfProgress, parentTasks, baseDate);
      baseRange.setValues(newData);
    };
  };

  if (selectedItem === 'lv1' || selectedItem === 'lv2' || selectedItem === 'lv3' || selectedItem === 'lv4' || selectedItem === 'lv5'){
    Logger.log('edit taskId');
    var taskEndLine = baseData[1].indexOf('lv5')+1;
    var taskRange = schedule.getRange(1, 1, lastRowOfContents, 1);
    var taskData = taskRange.getValues();

    if(e.range.isBlank()){
      Logger.log('delete taskId');
      var isBlank = true;
      var index = editedRow-1;
      var len = lastRowOfContents < lastRow ? lastRowOfContents : lastRow;
        //don't delete id if there's a value from lv1 to lv5.
        for(i = index; i < len; i++){
          for (j = 1; j < taskEndLine; j++){
            if(baseData[i][j] != ''){
              isBlank = false;
            };
          };
          if(isBlank){
            taskData[i][0] = '';
            baseData[i][0] = ''; //for the function: makeParentBold
          };
        };
        taskRange.setValues(taskData);
      };

      if(!e.range.isBlank()) {
        Logger.log('add taskId');
        var data = createTaskId(baseData, taskData, taskEndLine, editedRow);
        taskRange.setValues(data.taskData);
        baseData = data.baseData; //for the function: makeParentBold
      };
      makeParentBold(baseData, baseRange);
    };

    //restore id if necessary
    if (selectedItem === 'id'){
      if(e.oldValue){
        var lang = memo.getProperty('lang');
        var text = lang === 'ja' ? '本当に編集しますか？タスクIDを編集すると「工数（予）」と「進捗」の計算に不具合が発生します。' : 'Will you edit the task ID? If you do so, system error will happen when calculating workload and progress.';
        var isDelete = Browser.msgBox(text, Browser.Buttons.YES_NO);
        if(isDelete === 'no'){
          e.range.setValue(e.oldValue);
        };
      };
    };
  };

  if (e.source.getActiveSheet().getName() === 'holiday'){
    Logger.log('for the holiday sheet');
    if(e.range.getColumn() === 1){
      var schedule = getScheduleSheet();
      var memo = PropertiesService.getDocumentProperties();
      var baseLine = findStartPoint('progress')+1;
      var baseDate = Moment.moment(schedule.getRange(1, baseLine).getValue());
      var timeDiff = parseInt(memo.getProperty('timeDiff'));
      baseDate = baseDate.subtract(timeDiff, 'hours');
      formatGantchart(7, baseDate);

    };
  };
};