// Copyright (c) 2025, Khaled Jallad and contributors
// For license information, please see license.txt
let start_date = null;
let end_date = null;
let liaison_officer = null;
let employee_number = null;
let on_behalf = null;
let project_manager = null;
let repeted = 0;
const usedColors = new Set();
frappe.ui.form.on("Food Expenses", {
      before_workflow_action:function(frm){
        if(frm.selected_workflow_action === 'Reject'){
            frappe.dom.unfreeze();
            return new Promise(resolve => {
                frappe.prompt(
                  [{
                    fieldtype: 'Small Text',
                    fieldname: 'reject_reason',
                    label: __('Reason for Rejection'),
                    reqd: 1
                  }],
                  values => {
                    frm.set_value('custom_rejected_reason',  values.reject_reason);
                    frm.save().then(() => resolve());
                  },
                  __('Please provide a reason before rejecting')
                );
            });
        }
        if(frm.doc.custom_rejected_reason){
            frm.set_value('custom_rejected_reason', null);
        }
    },
    after_workflow_action:async function(frm){

        if(frm.doc.workflow_state === "Initiator") return;
        await get_project_data(frm)
        console.log(on_behalf)
        await add_assigend_to(frm)
    },
	refresh:async function(frm) {
        await get_employee_number(frm)
        if(!frm.doc.project)return;
        await get_project_data(frm)
        change_table_functionlaty(frm)
		
        if(!frm.is_new()){
            coloring_table(frm)
        	await expsnes_details_table(frm)
            if(frm.doc.custom_rejected_reason &&  (liaison_officer === employee_number || frappe.user.has_role("System Manager"))){
                show_rejected_reson(frm)
            }
            // if(frm.doc.workflow_state === 'Rejected' || frm.doc.workflow_state === "Initiator"){
            //     if(liaison_officer === employee_number || frappe.user.has_role("System Manager")){
            //         frm.page.actions_btn_group.show(); 
            //     }else{
            //         frm.page.actions_btn_group.hide(); 
            //     }
            // }

            if(frm.doc.workflow_state === 'On Behalf'){
                if(on_behalf === employee_number){
                    frm.page.actions_btn_group.show(); 
                }else{
                    frm.page.actions_btn_group.hide();  
                }
            }
            

        }else{
            frm.clear_table("expenses");
            frm.refresh_field("expenses")
            if(liaison_officer === employee_number || frappe.user.has_role("System Manager")){
            if(frappe.user.has_role("System Manager")){
                frm.set_value('employee', liaison_officer)
            }
        }else{
            frappe.throw("You are not authorized as a Liaison Officer, and therefore you do not have permission to access this page.")
            setTimeout(() => {
                window.history.back();
            }, 3000)
        }
        }
	},
    start_date:function(frm){
        if (!frm.doc.start_date) return;
        get_start_and_end_date(frm)
    },
    after_save: function (frm) {
        expsnes_details_table(frm)
    },
});
frappe.ui.form.on("Food Expense Item", {
	 before_expenses_remove:function(frm, cdt, cdn){
        const delete_item = locals[cdt][cdn];
        if(!delete_item.group) return;
        const all_rows = frm.doc.expenses || [];
        const grid = frm.fields_dict.expenses.grid;
        const groups = all_rows.filter(item => item.group === delete_item.group)
        .filter(item => item.name !== delete_item.name);
        groups.forEach((row) => {
            frappe.model.remove_from_locals(row.doctype, row.name);
        })
        frm.refresh_field('expenses');
        get_all_amounts_and_the_allowed_one(frm)
    },
    amount:async function(frm, cdt, cdn){
        const row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'sanctioned_amount', row.amount)
    },
    sanctioned_amount:async function(frm, cdt, cdn){
        const row = locals[cdt][cdn];
        let sum = 0;
        const expenses = frm.doc.expenses || [];
        let employees = expenses.filter(item => item.employee === row.employee);
        if (employees.length > 1) {
            for (const item of employees) {
                let weekly_limit = 0;
                    let isPartner = await is_partner(item.employee);
                     if(isPartner.status === 200){
                            weekly_limit = 225
                        }else{
                            const Weeklyattendants =  await getEmployeeWeeklyAttendance(item.employee, frm.doc.start_date, frm.doc.end_date)
                                if(Weeklyattendants.status === 200){
                                    weekly_limit = Weeklyattendants.data.length * 45
                                }
                        }
                    const amt = parseFloat(item.amount) || 0;
                    const prevSum = sum;
                    sum += amt;
                    if (sum > weekly_limit) {
                        const allowedForThisRow =  Math.abs(weekly_limit - prevSum);
                        frappe.model.set_value(
                            cdt,
                            item.name,
                            'sanctioned_amount',
                            allowedForThisRow
                        );
                        sum = weekly_limit;
                    }
            }
        } else {
            let weekly_limit = 0
            let isPartner = await is_partner(row.employee);
            if(isPartner.status === 200){
                    weekly_limit = 225
            }else{    
                const Weeklyattendants =  await getEmployeeWeeklyAttendance(row.employee, frm.doc.start_date, frm.doc.end_date)
                if(Weeklyattendants.status === 200){
                    weekly_limit = Weeklyattendants.data.length * 45
                }
            }
            if ((parseFloat(row.amount) || 0) > weekly_limit) {
                const new_amount = Math.min(row.sanctioned_amount, weekly_limit);
                frappe.model.set_value(cdt, cdn, 'sanctioned_amount', new_amount);
            }
        }
        get_all_amounts_and_the_allowed_one(frm) 
    },


});

async function add_assigend_to(frm){
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.assign_food_expenses",
        args:{workflow_state:frm.doc.workflow_state, name:frm.doc.name, project_manager:project_manager, on_behalf:on_behalf}
    })

  
}
async function get_employee_number(frm){
    let employee = null;
    const  response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_employee_number",
        args:{user:frappe.session.user}
    })
   if(response.message.status === 404){
        if(frappe.user.has_role("System Manager")){
            frm.set_df_property('employee', 'read_only', true);
        }else{
            frm.set_df_property('employee', 'read_only', true);
            frappe.throw(response.message.message);
        }
   }else{
        response.message.data.forEach(item => employee = item.name)
        employee_number = employee;
	   if(frm.is_new()){
        	frm.set_value('employee', employee)
	   }
   }
}
async function get_project_data(frm){
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_project_data",
        args:{project_name:frm.doc.project}
    })
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{
        for (const item of response.message.data){
            if(item.expected_start_date === null || item.expected_end_date === null){
                frappe.throw('The expected start date or expected end date is missing. Please contact your system administrator to resolve this issue.')
                return;
            }
            start_date = item.expected_start_date
            end_date = item.expected_end_date
            liaison_officer = item.custom_liaison_officer
            project_manager = item.project_manager
            on_behalf = item.custom_on_behalf
        }
    }
}
async function is_partner(employee){
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.is_partner",
        args:{employee:employee}
    })
    return response.message
}
async function get_expenses_food(frm){
    const respense = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_expenses_food",
        args:{project: frm.doc.project, start_date:frm.doc.start_date, end_date:frm.doc.end_date}
    })
    if(respense.message.status === 200){
        frm.set_value('start_date', null);
        frm.set_value('end_date', null);
        frappe.throw('An existing expense food has already been submitted for the same period on this project')
    }
}
async function getEmployeeWeeklyAttendance(employee, week_start_date, week_end_date){
    const responce = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.getEmployeeAllWeekAttendance",
        args:{employee:employee, week_start_date:week_start_date, week_end_date:week_end_date}
    });
    return responce.message
}
async function hasMarkedAttendanceToday(employee, date){
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.employeeHasAttendToday",
        args:{employee:employee, date:date}
    });
    return response.message
}
async function get_start_and_end_date(frm){
        const fd = frappe.datetime.str_to_obj(frm.doc.start_date);
        const sd = frappe.datetime.str_to_obj(start_date);
        const ed = frappe.datetime.str_to_obj(end_date);
        if (fd < sd || fd > ed) {
            frm.set_value('start_date', null);
            frm.set_value('end_date', null);
            frappe.throw(`Date must be between ${start_date} and ${end_date}`)
            return;
        }
        let d = new Date(frm.doc.start_date);
        const today = d.getDay();

        if(today === 5 || today === 6){
            frm.set_value('start_date', null);
            frm.set_value('end_date', null);
            frappe.throw('Date cannot be Friday or Saturday.')
            return;
        }

        let first_week_start = new Date(start_date);
        first_week_start.setDate(first_week_start.getDate() - first_week_start.getDay()); 
        let first_week_end = new Date(first_week_start);
        first_week_end.setDate(first_week_start.getDate() + 4);


        if(d >= first_week_start && d <= first_week_end){
            frm.set_value("start_date", start_date);
        }else{
            let daysSincePrevSun = (today - 0 + 7) % 7;
             if(daysSincePrevSun !== 0){
                d.setDate(d.getDate() - daysSincePrevSun);
                const py = d.getFullYear(),
                pm = String(d.getMonth()+1).padStart(2, "0"),
                pdd = String(d.getDate()).padStart(2, "0");
                frm.set_value("start_date", `${py}-${pm}-${pdd}`)
            }
        }
        let last_week_end = new Date(end_date);
        let last_week_start = new Date(last_week_end);
        last_week_start.setDate(last_week_start.getDate() - last_week_start.getDay()); // back to Sunday

        if(d >= last_week_start && d <= last_week_end){
            frm.set_value("end_date", end_date);
        }else{
            let daysUntilNextThu = (4 - today + 7) % 7;
        
            if (daysUntilNextThu === 0) daysUntilNextThu = 7;
       
            d.setDate(d.getDate() + daysUntilNextThu);
            const y = d.getFullYear(),
            m = String(d.getMonth()+1).padStart(2, "0"),
            dd = String(d.getDate()).padStart(2, "0");
            frm.set_value('end_date', `${y}-${m}-${dd}`);
        }

       
        await get_expenses_food(frm)
}
async function get_employee_name(employee){
    let employee_name = null;
    response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_employee_name",
        args:{name:employee}
    })
    if(response.message.status === 404){
        frappe.throw(response.message.message);
    }else{
        response.message.data.forEach(item => employee_name = item.employee_name)
        return employee_name
    }
}
function change_table_functionlaty(frm){
    const field = frm.get_field('expenses');
    const grid = field.grid;
    const orig_add = grid.add_new_row.bind(grid);
        grid.wrapper.find('.grid-add-row').off('click').on('click', () => {
            if (!frm.doc.start_date) {
                frappe.throw('Start date must be set before adding rows')                  
            }
            petty_cash_food_popup(frm);
    });
    const orig_refresh = grid.refresh.bind(grid);
        grid.refresh = function() {
            orig_refresh();          
            this.wrapper.find('.col-action').remove();
            add_action_buttons(frm);
        };
}
function add_action_buttons(frm) {
  const fieldname = 'expenses';
  const grid = frm.fields_dict[fieldname].grid;
  if (!grid) return;
  // Header cell
  const $hdr = grid.wrapper.find('.grid-row-head .data-row');
  if (!$hdr.find('.col-action').length) {
    $hdr.append(`
      <div class="col grid-static-col col-auto text-center col-action">
        <span>Action</span>
      </div>
    `);
  }
  // One cell per data row
  Object.values(grid.grid_rows_by_docname).forEach(row_widget => {
    const { name: cdn } = row_widget.doc;
    const $row = row_widget.wrapper.find('.data-row');
    // skip if already injected
    if ($row.find('.col-action').length) return;
    const $cell = $(`
      <div class="col grid-static-col col-auto text-center col-action">
        <a class="btn-my-action">
          <svg class="icon icon-xs" aria-hidden="true">
            <use href="#icon-edit"></use>
          </svg>
        </a>
      </div>
    `);
    $(grid.wrapper).find('.btn-open-row').closest('.col').hide()
    $row.append($cell);
    $cell.find('.btn-my-action').on('click', e => {
      e.stopPropagation();
      petty_cash_food_popup_edit(frm, cdn);
    });
});
}
function petty_cash_food_popup(frm){
        let allowed_employees = []; 
        const expenses = frm.doc.expenses || [];
        const d = new frappe.ui.Dialog({
              title: __('Food Allowance'),
              size: 'large',
              fields: [
                { label: __('Request type'), fieldname: 'food_type', fieldtype: 'Select',
                  options: ['Single','Group'], reqd:1,
                  onchange() {
                    d.set_df_property('items','hidden', false);
                  }
                },
                { fieldtype:'Section Break' },
                { label: __('Expense Date'), fieldname:'expense_date', fieldtype:'Date', reqd:1,
                  onchange: async function() {
                    if(!this.get_value()) return;
                    const exd = frappe.datetime.str_to_obj(this.get_value());
                    const sd  = frappe.datetime.str_to_obj(frm.doc.start_date);
                    const ed  = frappe.datetime.str_to_obj(frm.doc.end_date);
                    if (exd < sd || exd > ed) {
                        this.set_value(null)
                        frappe.throw(`Date must be between ${frm.doc.start_date} and ${frm.doc.end_date}`)
                    }
                    allowed_employees = await get_allowed_employee(frm.doc.project, this.get_value());
                  }
                },
                { label: __('Category'), fieldname:'ctegory', fieldtype:'Select', options: ['Dinner Meal','Lunch Meal', 'breakfast', 'Dessert'],reqd:1},
                { label: __('Invoice No.'), fieldname:'invoice_no', fieldtype:'Data', reqd:1, 
                    onchange:function(){
                        if(!this.get_value()) return;
                        if (expenses.length > 0){
                            const invoices = new Set();
                             expenses.forEach(item => invoices.add(item.invoice_no))
                             if(invoices.has(this.get_value())){
                                this.set_value(null)
                                frappe.throw('Please ensure that each invoice is assigned a unique number.')
                             }
                        }
                    }
                },
                { fieldtype:'Column Break' },
                { label: __('Total Amount'), fieldname:'total_amount', fieldtype:'Currency', reqd:1,},
                { label: __('Invoice Image'), fieldname:'invoice_image', fieldtype:'Attach', reqd:1,  
                },
                { fieldtype:'Section Break' },
                {
                  fieldtype:'Table', fieldname:'items', label:__('Items'), in_place_edit:true, data: [{}], reqd: 1 ,
                  fields: [
                    { fieldtype:'Link', fieldname:'employee', options:'Employee', label:__('Employee'), in_list_view:1, reqd:1,
                    onchange: async function(){
                        if(!this.get_value()) return ;
                        const employee = this.get_value();
                        const items = d.get_value('items');
                        let weekly_limt = 0;
                        if(!d.get_value('expense_date')){
                            this.set_value(null);
                            frappe.throw(`Please fill Expense Date before selecting an employee`);
                        }
                            let isPartner = await is_partner(employee);
                            if(isPartner.status === 200){
                                 weekly_limt = 225
                            }else{
                                const attendants =  await hasMarkedAttendanceToday(employee, d.get_value('expense_date'));
                                if(attendants.status === 404){
                                    this.set_value(null)
                                    await frappe.throw(`There is no chick in for this employee ${employee}  in date ${d.get_value('expense_date')}`)
                                }else{
                                    const Weeklyattendants =  await getEmployeeWeeklyAttendance(employee, frm.doc.start_date, frm.doc.end_date)
                                    if(Weeklyattendants.status === 200){
                                        weekly_limt = Weeklyattendants.data.length * 45
                                    }
                                }
                            }
                            if(expenses.length > 0){
                                let data = expenses.filter(item => item.employee === employee);
                                let amount = 0;
                                for (const item of data){
                                    amount += item.amount
                                    if(amount >= weekly_limt){
                                        this.set_value(null); 
                                        await frappe.throw(`Employee ${employee} have exceeded the weekly limit of ${weekly_limt}.`)
                                    }
                                }
                            }
                        if(items.length > 1){
                            const employee_count = items.filter(row => row.employee === employee).length
                            if(employee_count > 1){
                                this.set_value(null); 
                                await frappe.throw('Please ensure that each employee is selected only once in the table.')
                            }
                        }
                    },
                    get_query:function(){
                        return {
                          filters:{
                            name: ['in', allowed_employees]
                          },
                          ignore_user_permissions: true
                        };
                    }
                    },
                    { fieldtype:'Currency', fieldname:'amount', label:__('Amount'), in_list_view:1, reqd:1,
                     onchange: async function() {
                        const val = parseFloat(this.get_value()) || 0;
                        if (!val) return;
                        const total_amount = parseFloat(d.get_value('total_amount')) || 0;
                        if (total_amount === 0) {
                            this.set_value(null);
                            frappe.throw('Total Amount is missing');
                        }
                        if (d.get_value('food_type') === 'Single') {
                            this.set_value(null);
                            frappe.throw('For Single type, total amount must equal the item amount.');
                        }else{
                            const items = d.get_value('items');
                            let amounts = 0;
                            items.map((items) =>{
                                amounts += items.amount;
                            });
                            if(amounts > total_amount){
                                this.set_value(null);
                                this.doc.employee = null
                                frappe.throw('The combined amount of all items has reached the maximum allowed total. Please adjust one or more item amounts before proceeding.')
                            }
                        }
                    }
                    }
                  ],
                }
              ],
              primary_action_label: __('Save'),
              primary_action:async function(values) {
                let empty_value = values.items.some(item => !item.employee || !item.amount)
                  if(values.items.length === 0 || empty_value){
                       frappe.throw('Kindly ensure that all records in the table are fully completed before saving.') 
                        return;      
                  }
                    const sum = (values.items || []).map(item => parseFloat(item.amount) || 0).reduce((a, b) => a + b, 0);
                    if (sum !== parseFloat(values.total_amount)) {
                        frappe.throw(`Total Amount ${values.total_amount} must equal the sum of individual amounts ${sum}.`)
                    }
                  let random_character = null;
                  let row_bg_color = null;
                  switch(values.food_type){
                        case "Single":
                            const child = frm.add_child('expenses');
                            let c = 0;
                            values.items.map((item) => {
                                frappe.model.set_value(child.doctype, child.name,'amount',       item.amount);
                                frappe.model.set_value(child.doctype, child.name,'employee',      item.employee);
                            })
                            frappe.model.set_value(child.doctype, child.name,'expense_date',  values.expense_date);
                            frappe.model.set_value(child.doctype, child.name,'category',  values.ctegory);
                            frappe.model.set_value(child.doctype, child.name,'total_amount', values.total_amount);
                            frappe.model.set_value(child.doctype, child.name,'invoice_image', values.invoice_image);
                            frappe.model.set_value(child.doctype, child.name,'invoice_no',  values.invoice_no);
                        break;
                        case "Group":
                            if(values.items.length === 1){
                                d.set_value("food_type", "Single")
                                random_character = null;
                            }else{
                                random_character = generateRandomString(8);
                                row_bg_color = getRandomLightColor();
                            }  
                            values.items.map((item) => {
                                const child = frm.add_child('expenses');
                                frappe.model.set_value(child.doctype, child.name,'amount', item.amount);
                                frappe.model.set_value(child.doctype, child.name,'employee',item.employee);
                                frappe.model.set_value(child.doctype, child.name,'category',  values.ctegory);
                                frappe.model.set_value(child.doctype, child.name,'expense_date',  values.expense_date);
                                frappe.model.set_value(child.doctype, child.name,'total_amount', values.total_amount);
                                frappe.model.set_value(child.doctype, child.name,'invoice_image', values.invoice_image);
                                frappe.model.set_value(child.doctype, child.name,'group',  random_character);
                                frappe.model.set_value(child.doctype, child.name,'invoice_no',  values.invoice_no);
                            })  
                        break;
                  }
                frm.refresh_field('expenses');
                if(d.get_value("food_type") === 'Group'){
                    const grid = frm.fields_dict.expenses.grid;
                    const rows_name = frm.doc.expenses || []
                    if(rows_name.length > 0){
                        const rows = rows_name.filter(item => item.group === random_character)    
                        rows.forEach((item) => {
                            const gridRow = grid.grid_rows_by_docname[item.name];
                              if (gridRow) {
                                    gridRow.row.css('background-color', row_bg_color);
                              }
                        })
                    }
                   frm.refresh_field('expenses');  
                }
                d.hide();
              }
            });
        d.set_df_property('items','hidden',true);
        d.show();
        const grid = d.fields_dict['items'].grid;
        d.fields_dict.expense_date.$input.on('change', function() {
            const table = d.fields.find(items => items.fieldname === 'items');
            table.data = [];
            grid.refresh();
            grid.add_new_row();
        });
        d.fields_dict.food_type.$input.on('change', function() {
            const tableField = d.fields_dict.items;
            d.set_value('total_amount', 0)
            if(d.get_value('food_type') === 'Single'){
                tableField.df.cannot_add_rows = 1
            }else{
                tableField.df.cannot_add_rows = 0
            }
            const table = d.fields.find(items => items.fieldname === 'items');
            table.data = [];
            grid.refresh();
            grid.add_new_row();
        });
        d.fields_dict.total_amount.$input.on('change', function() {
            const tableField = d.fields_dict.items;
            if(d.get_value('food_type') === 'Single'){
              grid.get_data().forEach((item) => {
                item.amount = d.get_value('total_amount')
              })  
            }
            grid.refresh();
        });
}
async function petty_cash_food_popup_edit(frm, cdn){
    let expenses = frm.doc.expenses || [];
    let data = [];
    let expense_date = null;
    let total_amount = null;
    let category = null;
    let invoice_image = null;
    let group = null
    let invoice_no = null;
    let type = null;
    let allowed_employees = [];
    const selected_data = expenses.filter((item) => item.name === cdn);
    selected_data.forEach((item) => {
        expense_date = item.expense_date;
        total_amount = item.total_amount;
        category = item.category;
        invoice_no = item.invoice_no
        invoice_image = item.invoice_image;
        type = item.group ? 'Group' : 'Single';
        group = item.group;
        if(!group){
            data.push({
                employee:item.employee,
                amount:item.amount,
            })
        }
    });
    allowed_employees = await get_allowed_employee(frm.doc.project, expense_date);
    if(group){
        const group_data = expenses.filter((item) => item.group === group);
        group_data.forEach((item) => {
            data.push({
                employee:item.employee,
                amount:item.amount,
                doc_row:item.name
            })    
        })
    }
     const d = new frappe.ui.Dialog({
              title: __('Expenses Details Edit'),
              size: 'large',
              fields: [
                { label: __('Request type'), fieldname: 'food_type', fieldtype: 'Select',
                  options: ['Single','Group'], reqd:1,
                  onchange() {
                    const tableField = d.fields_dict.items;
                    const grid = tableField.grid;
                    d.set_df_property('items','hidden', this.get_value());
                  },
                  default: type.toString()
                },
                { fieldtype:'Section Break' },
                { label: __('Expense Date'), fieldname:'expense_date', fieldtype:'Date', reqd:1,
                  onchange:async function() {
                    if(!this.get_value()) return; 
                    const exd = frappe.datetime.str_to_obj(this.get_value());
                    const sd  = frappe.datetime.str_to_obj(frm.doc.start_date);
                    const ed  = frappe.datetime.str_to_obj(frm.doc.end_date);
                    if (exd < sd || exd > ed) {
                        this.set_value(null)
                        frappe.throw(`Date must be between ${frm.doc.start_date} and ${frm.doc.end_date}`)
                    }
                    
                    allowed_employees = await get_allowed_employee(frm.doc.project, this.get_value());
                  },
                  default:expense_date
                },
                { label: __('Category'), fieldname:'ctegory', fieldtype:'Select', options: ['Dinner Meal','Lunch Meal', 'breakfast', 'Dessert'],
                reqd:1,
                default:category
                },
                { label: __('Invoice No.'), fieldname:'invoice_no', fieldtype:'Data',reqd:1,
                    onchange:function(){
                        if(!this.get_value()) return;
                        if (expenses.length > 0){
                            const invoices = new Set();
                             expenses.forEach(item => invoices.add(item.invoice_no))
                             if(invoices.has(this.get_value())){
                                this.set_value(null)
                                frappe.throw('Please ensure that each invoice is assigned a unique number.')
                             }
                        }
                    },
                    default:invoice_no
                },
                { fieldtype:'Column Break' },
                { label: __('Total Amount'), fieldname:'total_amount', fieldtype:'Currency',
                    reqd:1,
                    default:total_amount
                },
                { label: __('Invoice Image'), fieldname:'invoice_image', fieldtype:'Attach',
                    reqd:1,
                    default:invoice_image
                },
                { fieldtype:'Section Break' },
                {
                  fieldtype:'Table', fieldname:'items', label:__('Items'), in_place_edit:true, data: data, reqd: 1 ,
                  fields: [
                    { fieldtype:'Link', fieldname:'employee', options:'Employee', label:__('Employee'), in_list_view:1, reqd:1,
                     onchange: async function(){
                        if(!this.get_value()) return ;
                        const employee = this.get_value();
                        const items = d.get_value('items');
                        let weekly_limt = 0;
                        if(!d.get_value('expense_date')){
                            this.set_value(null);
                            frappe.throw(`Please fill Expense Date before selecting an employee`);
                        }
                            let isPartner = await is_partner(employee);
                            if(isPartner.status === 200){
                                 weekly_limt = 225
                            }else{
                                const attendants =  await hasMarkedAttendanceToday(employee, d.get_value('expense_date'));
                                if(attendants.status === 404){
                                    this.set_value(null)
                                    await frappe.throw(`There is no chick in for this employee ${employee}  in date ${d.get_value('expense_date')}`)
                                }else{
                                    const Weeklyattendants =  await getEmployeeWeeklyAttendance(employee, frm.doc.start_date, frm.doc.end_date)
                                    if(Weeklyattendants.status === 200){
                                        weekly_limt = Weeklyattendants.data.length * 45
                                    }
                                }
                            }
                            if(expenses.length > 0){
                                let data = expenses.filter(item => item.employee === employee);
                                let amount = 0;
                                for (const item of data){
                                    amount += item.amount
                                    if(amount >= weekly_limt){
                                        this.set_value(null); 
                                        await frappe.throw(`Employee ${employee} have exceeded the weekly limit of ${weekly_limt}.`)
                                    }
                                }
                            }
                        if(items.length > 1){
                            const employee_count = items.filter(row => row.employee === employee).length
                            if(employee_count > 1){
                                this.set_value(null); 
                                await frappe.throw('Please ensure that each employee is selected only once in the table.')
                            }
                        }
                    },
                    get_query:function(){
                        return {
                          filters:{
                            name: ['in', allowed_employees]
                          },
                          ignore_user_permissions: true
                        };
                    }
                    },
                    { fieldtype:'Currency', fieldname:'amount', label:__('Amount'), in_list_view:1, reqd:1,
                        onchange: async function() {
                        const val = parseFloat(this.get_value()) || 0;
                        if (!val) return;
                        const total_amount = parseFloat(d.get_value('total_amount')) || 0;
                        if (total_amount === 0) {
                            this.set_value(null);
                            frappe.throw('Total Amount is missing');
                        }
                        if (d.get_value('food_type') === 'Single') {
                            this.set_value(null);
                            frappe.throw('For Single type, total amount must equal the item amount.');
                        }else{
                            const items = d.get_value('items');
                            let amounts = 0;
                            items.map((items) =>{
                                amounts += items.amount;
                            });
                            if(amounts > total_amount){
                                this.set_value(null);
                                this.doc.employee = null
                                frappe.throw('The combined amount of all items has reached the maximum allowed total. Please adjust one or more item amounts before proceeding.')
                            }
                        }
                    }
                    },
                  ],
                }
              ],
              primary_action_label: __('Save'),
              primary_action(values) {
                let empty_value = values.items.some(item => !item.employee || !item.amount)
                  if(values.items.length === 0 || empty_value){
                       ffrappe.throw('Kindly ensure that all records in the table are fully completed before saving.')
                        return;
                  }
                    const sum = (values.items || []).map(item => parseFloat(item.amount) || 0).reduce((a, b) => a + b, 0);
                    if (sum !== parseFloat(values.total_amount)) {
                        frappe.throw(`Total Amount ${values.total_amount} must equal the sum of individual amounts ${sum}.`)
                    return;
                    }
                  let random_character = null;
                  let row_bg_color = null;
                  switch(values.food_type){
                        case "Single":
                            if(!group){
                                values.items.map((item) => {
                                    frappe.model.set_value('Food Expense Item', cdn,'amount', item.amount);
                                    frappe.model.set_value('Food Expense Item', cdn,'employee', item.employee);
                                })
                                frappe.model.set_value('Food Expense Item', cdn,'expense_date',  values.expense_date);
                                frappe.model.set_value('Food Expense Item', cdn,'category',  values.ctegory);
                                frappe.model.set_value('Food Expense Item', cdn,'total_amount', values.total_amount);
                                frappe.model.set_value('Food Expense Item', cdn,'invoice_image', values.invoice_image);
                                frappe.model.set_value('Food Expense Item', cdn,'invoice_no',  values.invoice_no);
                            }else{
                                const group_to_Single = expenses.filter(item => item.group === group)
                                group_to_Single.forEach((item) => {
                                    frappe.model.remove_from_locals('Food Expense Item', item.name);
                                })
                                frm.refresh_field('expenses');
                                const child = frm.add_child('expenses');
                                values.items.map((item) => {
                                    frappe.model.set_value(child.doctype, child.name,'amount',       item.amount);
                                    frappe.model.set_value(child.doctype, child.name,'employee',      item.employee);
                                })
                                frappe.model.set_value(child.doctype, child.name,'expense_date',  values.expense_date);
                                frappe.model.set_value(child.doctype, child.name,'category',  values.ctegory);
                                frappe.model.set_value(child.doctype, child.name,'total_amount', values.total_amount);
                                frappe.model.set_value(child.doctype, child.name,'invoice_image', values.invoice_image);
                                frappe.model.set_value('Food Expense Item', cdn,'invoice_no',  values.invoice_no);
                            }
                        break;
                        case "Group":
                            let table_grid = frm.fields_dict.expenses.grid;
                            const gridRow = table_grid.grid_rows_by_docname[cdn];
                            const rowElem = gridRow.row;
                            const color = rowElem[0].style.backgroundColor
                            let foodType = "Group";
                            if(values.items.length === 1){
                                d.set_value("food_type", "Single")
                                random_character = null;
                            }
                            if(group){
                                    data.forEach((item) => {
                                        frappe.model.remove_from_locals('Food Expense Item', item.doc_row);
                                            frm.refresh_field('expenses');
                                    })
                                values.items.map((item) => {
                                    const child = frm.add_child('expenses');
                                    frappe.model.set_value(child.doctype, child.name,'amount', item.amount);
                                    frappe.model.set_value(child.doctype, child.name,'employee',item.employee);
                                    frappe.model.set_value(child.doctype, child.name,'category',  values.ctegory);
                                    frappe.model.set_value(child.doctype, child.name,'expense_date',  values.expense_date);
                                    frappe.model.set_value(child.doctype, child.name,'total_amount', values.total_amount);
                                    frappe.model.set_value(child.doctype, child.name,'invoice_image', values.invoice_image);
                                    frappe.model.set_value(child.doctype, child.name,'group',  group);
                                    frappe.model.set_value(child.doctype, child.name,'invoice_no',  values.invoice_no);
                                });
                                frm.refresh_field('expenses');
                                const rows_name = frm.doc.expenses || []
                                if(rows_name.length > 0){
                                    const rows = rows_name.filter(item => item.group === group)
                                        rows.forEach((item) => {
                                            if (gridRow) {
                                                const gridRow_new = table_grid.grid_rows_by_docname[item.name];
                                                gridRow_new.row.css('background-color', rowElem[0].style.backgroundColor);
                                            }
                                        })
                                    }
                            }else{
                                const generated_new_group = generateRandomString(8);
                                const generated_new_color = getRandomLightColor();
                                frappe.model.remove_from_locals('Food Expense Item', cdn);
                                values.items.map((item) => {
                                     const child_new = frm.add_child('expenses');
                                            frappe.model.set_value(child_new.doctype, child_new.name,'amount', item.amount);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'employee',item.employee);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'category',  values.ctegory);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'expense_date',  values.expense_date);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'total_amount', values.total_amount);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'invoice_image', values.invoice_image);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'group',  generated_new_group);
                                            frappe.model.set_value(child_new.doctype, child_new.name,'invoice_no',  values.invoice_no);
                                });
                                frm.refresh_field('expenses');
                                 if(d.get_value("food_type") === 'Group'){
                                    const grid_generated_new = frm.fields_dict.expenses.grid;
                                    const rows_generated_new = frm.doc.expenses || []
                                    if(rows_generated_new.length > 0){
                                        const rows_name_generated_new = rows_generated_new.filter(item => item.group === generated_new_group)
                                        rows_name_generated_new.forEach((item) => {
                                            const gridRow_generated_new = grid_generated_new.grid_rows_by_docname[item.name];
                                              if (gridRow_generated_new) {
                                                    gridRow_generated_new.row.css('background-color', generated_new_color);
                                              }
                                        })
                                    }
                                  frm.refresh_field('expenses');
                                }
                            }
                        break;
                    }
                d.hide();
              }
            });
            d.show();
            d.fields_dict.expense_date.$input.on('change', function() {
                const table = d.fields.find(items => items.fieldname === 'items');
                table.data = [];
                grid.refresh();
                grid.add_new_row();
            });
            const grid = d.fields_dict['items'].grid;
            const tableField = d.fields_dict.items;
            d.fields_dict.food_type.$input.on('change', function() {
                d.set_value('total_amount', 0)
                if(d.get_value('food_type') === 'Single'){
                    tableField.df.cannot_add_rows = 1
                }else{
                    tableField.df.cannot_add_rows = 0;
                }
                const table = d.fields.find(items => items.fieldname === 'items');
                table.data = [];
                grid.add_new_row();
            });
            d.fields_dict.total_amount.$input.on('change', function() {
                if(d.get_value('food_type') === 'Single'){
                  grid.get_data().forEach((item) => {
                    item.amount = d.get_value('total_amount');
                  });
                grid.refresh();
                }
            });
            if(d.get_value('food_type') === 'Single'){
                tableField.df.cannot_add_rows = 1;
            }else{
                tableField.df.cannot_add_rows = 0;
            }
            grid.refresh();
}
async function expsnes_details_table(frm) {
    let total_expenses = 0;
    let limted_total_expenses = 0;
    let rows = [];
    frm.set_df_property('food_details', 'options', null);
    let days = getWorkWeekDaysWithDateShort(frm.doc.start_date, frm.doc.end_date);
    let expenses = frm.doc.expenses || [];
    const employees = [...new Set(expenses.map(r => r.employee))];
    let dayTotals = new Array(days.length).fill(0);
    for (const item of employees) {
        console.log(item)
        const data = expenses
            .filter(r => r.employee === item)
            .sort((a, b) => new Date(a.expense_date) - new Date(b.expense_date));
        if (data.length === 0) continue;
        const year = frappe.datetime.str_to_obj(data[0].creation || data[0].modified).getFullYear();
        const employee_full_name = await get_employee_name(item);
        const isPartner = await is_partner(item);
        let weekly_limit = 0;
        if(isPartner.status === 200){
            weekly_limit = 225
        }else{
            const Weeklyattendants =  await getEmployeeWeeklyAttendance(item, frm.doc.start_date, frm.doc.end_date)
            if(Weeklyattendants.status === 200){
                weekly_limit = Weeklyattendants.data.length * 45
            }
        }
        const date_and_expenses = days.map((d, i) => {
            let [D, M] = d.date.split('/');
            D = D.padStart(2, '0');
            M = M.padStart(2, '0');
            const iso = `${year}-${M}-${D}`;
            const totalForDay = data
                .filter(item => item.expense_date === iso)
                .reduce((sum, item) => sum + item.amount, 0);
            dayTotals[i] += totalForDay;
            return {
                date: iso,
                amount: totalForDay
            };
        });
        let sum = 0;
        let row = `<tr class="text-center control-label"><td>${employee_full_name || ''} / ${item || ''} </td>`;
        for (let i = 0; i < date_and_expenses.length; i++) {
            sum += date_and_expenses[i].amount;
            row += `<td class="control-label">${date_and_expenses[i].amount}</td>`;
        }
        total_expenses += sum;
        limted_total_expenses +=  sum >= weekly_limit ? weekly_limit : sum;
        row += `
            <td class="control-label">${weekly_limit}</td>
            <td class="control-label">${sum}</td>
            <td class="control-label">${sum >= weekly_limit ? weekly_limit : sum}</td>
        </tr>`;
        rows.push(row);
    }
    // Build total row for each date
    let dayTotalsRow = `<tr class="text-center control-label"><td><b>Total</b></td>`;
    dayTotals.forEach(amount => {
        dayTotalsRow += `<td class="control-label"><b>${amount}</b></td>`;
    });
    dayTotalsRow += `
        <td class="control-label"><b>—</b></td>
        <td class="control-label"><b>${total_expenses}</b></td>
        <td class="control-label"><b>${limted_total_expenses}</b></td>
    </tr>`;
    let html = `<table class="table table-bordered align-middle text-center table-striped">
        <thead>
          <tr>
            <th class="control-label">Employee</th>
            ${days.map(item => `<th class="control-label">${item.day} <small>${item.date}</small></th>`).join("")}
            <th class="control-label">Max Expense (Policy)</th>
            <th class="control-label">Total Expenses</th>
            <th class="control-label">Amount Reimbursed</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
          ${dayTotalsRow}
        </tbody>
    </table>`;
    frm.set_df_property('food_details', 'options', html);
    frm.refresh_field('food_details');
}
function getWorkWeekDaysWithDateShort(startDateStr, endDateStr) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  let cur = new Date(startDateStr);
  const end = new Date(endDateStr);
  const result = [];
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow >= 0 && dow <= 4) {
      const dd = String(cur.getDate()).padStart(2, '0');
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      result.push({
        day: dayNames[dow],
        date: `${dd}/${mm}`
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
function getRandomLightColor() {
  let hex;
  do {
    const r = 200 + Math.floor(Math.random() * 56);
    const g = 200 + Math.floor(Math.random() * 56);
    const b = 200 + Math.floor(Math.random() * 56);
    hex = '#' + [r, g, b]
      .map(c => c.toString(16).padStart(2, '0'))
      .join('');
  } while (usedColors.has(hex));
  usedColors.add(hex);
  return hex;
} 
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +  
                'abcdefghijklmnopqrstuvwxyz' +  
                '0123456789';                     
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
}
function get_all_amounts_and_the_allowed_one(frm){
    const expense = frm.doc.expenses || [];
    let all_amounts = 0
    let allowed_amounts = 0
    let one_amount_in_group = [];
    let group = null
    if(expense.length > 0){
        expense.forEach((item) => {
            if(item.group && group !== item.group){
                group = item.group
                one_amount_in_group = expense.find(all_ag => item.group === all_ag.group);
            }else{
                all_amounts += item.total_amount;
            }
            allowed_amounts += item.sanctioned_amount
        })
        frm.set_value('total_expenses_amount', all_amounts);
        frm.set_value('total_sanctioned_amount', allowed_amounts);
    }
}
function coloring_table(frm){
    const expenses = frm.doc.expenses || [];
            const grid     = frm.fields_dict.expenses.grid;
            if (!grid || !expenses.length) return;
            const uniqueGroups = Array.from(
                new Set(expenses.map(r => r.group).filter(g => g))
            );
            uniqueGroups.forEach(group_id => {
                const color = getRandomLightColor();
                expenses
                .filter(r => r.group === group_id)
                    .forEach(r => {
                      const rowWidget = grid.grid_rows_by_docname[r.name];
                      if (rowWidget) {
                        rowWidget.row.css('background-color', color);
                      }
                    });
            });
            frm.refresh_field('expenses');
}
function show_rejected_reson(frm){
    if(repeted === 1) return;
    const dialog = new frappe.ui.Dialog({
            title: __('Notice'),
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'message',
                    options: `<div style="padding:1rem; font-size:1rem;">
                                ${frm.doc.custom_rejected_reason}
                            </div>`
                }
            ],
            primary_action_label: null,
           
            secondary_action: null
        });

        dialog.show();
        repeted = 0;    
}

async function get_allowed_employee(project, date){
    let employee = [];
    const response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_resorec_pool",
        args:{project:project, date:date}
    })

    if(response.message.status === 200){
        response.message.data.map((item) => {
            employee.push(item.employee)
        })
        return employee;
    }else{
        frappe.throw(response.message.message)
    }

}
