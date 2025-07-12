const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    convocatoria: {
        type: String,
        default: ''
    },
    grade: {
        type: String,
        default: ''
    },
    passed: {
        type: Boolean,
        default: false,
        set: function(value) {
            if (value === '' || value === null || value === undefined) {
                return false;
            }
            return Boolean(value);
        }
    }
});

const academicProgressSchema = new mongoose.Schema({
    userHash: {
        type: String,
        required: true,
        index: true
    },
    subjects: [subjectSchema],
    totalCredits: {
        type: Number,
        default: 0
    },
    requiredCredits: {
        type: Number,
        default: 356  // Default for LTI career
    },
    careerPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CareerPlan',
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Calculate total earned credits
academicProgressSchema.methods.calculateTotalCredits = function() {
    this.totalCredits = this.subjects
        .filter(subject => subject.passed)
        .reduce((sum, subject) => sum + subject.credits, 0);
    return this.totalCredits;
};

// Get remaining credits
academicProgressSchema.methods.getRemainingCredits = function() {
    return this.requiredCredits - this.totalCredits;
};

// Get progress percentage
academicProgressSchema.methods.getProgressPercentage = function() {
    return Math.min((this.totalCredits / this.requiredCredits) * 100, 100);
};

// Update required credits from career plan
academicProgressSchema.methods.updateRequiredCreditsFromPlan = async function() {
    if (this.careerPlan) {
        const CareerPlan = mongoose.model('CareerPlan');
        const plan = await CareerPlan.findById(this.careerPlan);
        
        if (plan && plan.totalCredits) {
            this.requiredCredits = plan.totalCredits;
        }
    }
    return this;
};

// Get subjects by semester based on selected plan
academicProgressSchema.methods.getSubjectsBySemester = async function() {
    if (!this.careerPlan) return {};
    
    const CareerPlan = mongoose.model('CareerPlan');
    const plan = await CareerPlan.findById(this.careerPlan);
    
    if (!plan) return {};
    
    const subjectsBySemester = {};
    
    plan.subjects.forEach(planSubject => {
        if (!subjectsBySemester[planSubject.semester]) {
            subjectsBySemester[planSubject.semester] = [];
        }
        
        const userSubject = this.subjects.find(s => 
            s.name.toLowerCase().includes(planSubject.name.toLowerCase()) ||
            planSubject.name.toLowerCase().includes(s.name.toLowerCase())
        );
        
        subjectsBySemester[planSubject.semester].push({
            ...planSubject.toObject(),
            userProgress: userSubject || null
        });
    });
    
    return subjectsBySemester;
};

// Get current semester based on completed subjects
academicProgressSchema.methods.getCurrentSemester = async function() {
    if (!this.careerPlan) return 1;
    
    const subjectsBySemester = await this.getSubjectsBySemester();
    
    for (let semester = 1; semester <= 8; semester++) {
        const semesterSubjects = subjectsBySemester[semester] || [];
        const completedInSemester = semesterSubjects.filter(s => 
            s.userProgress && s.userProgress.passed
        ).length;
        
        if (completedInSemester < semesterSubjects.length) {
            return semester;
        }
    }
    
    return 8; // Graduated or final semester
};

// Validate if new scraped data is of good quality compared to existing data
academicProgressSchema.methods.validateDataQuality = function(newSubjects) {
    const existingSubjects = this.subjects || [];
    const existingPassedCount = existingSubjects.filter(s => s.passed).length;
    const existingTotalCredits = existingSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0);
    
    const newPassedCount = newSubjects.filter(s => s.passed).length;
    const newTotalCredits = newSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0);
    
    // Data quality check: new data should not have significantly fewer subjects or credits
    const hasGoodQuality = {
        isValid: true,
        reason: null,
        existingStats: {
            passedSubjects: existingPassedCount,
            totalCredits: existingTotalCredits,
            totalSubjects: existingSubjects.length
        },
        newStats: {
            passedSubjects: newPassedCount,
            totalCredits: newTotalCredits,
            totalSubjects: newSubjects.length
        }
    };
    
    // If we have existing data, validate against it
    if (existingSubjects.length > 0) {
        // Check if new data has significantly fewer passed subjects (more than 10% loss)
        if (newPassedCount < existingPassedCount * 0.9) {
            hasGoodQuality.isValid = false;
            hasGoodQuality.reason = 'new_data_fewer_subjects';
        }
        
        // Check if new data has significantly fewer credits (more than 10% loss)
        if (newTotalCredits < existingTotalCredits * 0.9) {
            hasGoodQuality.isValid = false;
            hasGoodQuality.reason = 'new_data_fewer_credits';
        }
        
        // Check if new data is completely empty when we have existing data
        if (newSubjects.length === 0 && existingSubjects.length > 0) {
            hasGoodQuality.isValid = false;
            hasGoodQuality.reason = 'new_data_empty';
        }
    }
    
    return hasGoodQuality;
};

// Merge new subjects data with existing data (update grades, add new subjects)
academicProgressSchema.methods.mergeSubjectsData = function(newSubjects) {
    const existingSubjects = this.subjects || [];
    const mergedSubjects = [...existingSubjects];
    
    // Extract total credits from TOTAL row before filtering
    const totalRow = newSubjects.find(subject => 
        subject.name && subject.name.trim().toUpperCase() === 'TOTAL'
    );
    
    let earnedCredits = 0;
    if (totalRow && totalRow.name) {
        // Parse TOTAL row format: "TOTAL    356,00    12,00    344,00    0,00"
        // Extract second number (earned credits)
        const numbers = totalRow.name.match(/\d+[,.]?\d*/g);
        if (numbers && numbers.length >= 2) {
            earnedCredits = parseFloat(numbers[1].replace(',', '.'));
            if (!isNaN(earnedCredits)) {
                this.totalCredits = earnedCredits;
            }
        }
    }
    
    // Add or update TOTAL record in subjects array for dashboard access
    const existingTotalIndex = mergedSubjects.findIndex(subject => 
        subject.name && subject.name.trim().toUpperCase() === 'TOTAL'
    );
    
    const totalSubject = {
        name: 'TOTAL',
        credits: 0,
        type: earnedCredits.toString(),
        convocatoria: '',
        grade: '',
        passed: false
    };
    
    if (existingTotalIndex !== -1) {
        // Update existing TOTAL record
        mergedSubjects[existingTotalIndex] = totalSubject;
    } else {
        // Add new TOTAL record
        mergedSubjects.push(totalSubject);
    }
    
    // Filter out summary rows - don't process them as subjects (but keep TOTAL for dashboard)
    const summaryRowTypes = ['OBLIGATORIA', 'OPTATIVA', 'LIBRE CONFIGURACIÓN', 'PROYECTO', 'PRÁCTICAS PROFESIONALES'];
    const actualSubjects = newSubjects.filter(subject => 
        !summaryRowTypes.includes(subject.name && subject.name.trim().toUpperCase()) &&
        subject.name && subject.name.trim().toUpperCase() !== 'TOTAL'
    );
    
    actualSubjects.forEach(newSubject => {
        // Find existing subject by name (case-insensitive)
        const existingIndex = mergedSubjects.findIndex(existing => 
            existing.name.toLowerCase().trim() === newSubject.name.toLowerCase().trim()
        );
        
        if (existingIndex !== -1) {
            // Update existing subject - preserve all fields but update grades and status
            const existing = mergedSubjects[existingIndex];
            
            // Update grade if new data has a grade
            if (newSubject.grade && newSubject.grade.trim() !== '') {
                existing.grade = newSubject.grade;
            }
            
            // Update convocatoria if new data has it
            if (newSubject.convocatoria && newSubject.convocatoria.trim() !== '') {
                existing.convocatoria = newSubject.convocatoria;
            }
            
            // Update passed status based on new grade
            existing.passed = newSubject.passed;
            
            // Update credits if they changed (in case of curriculum updates)
            if (newSubject.credits && newSubject.credits > 0) {
                existing.credits = newSubject.credits;
            }
            
            // Update type if provided
            if (newSubject.type && newSubject.type.trim() !== '') {
                existing.type = newSubject.type;
            }
            
        } else {
            // Add new subject that wasn't in the existing data
            mergedSubjects.push({
                name: newSubject.name,
                credits: newSubject.credits || 0,
                type: newSubject.type || '',
                convocatoria: newSubject.convocatoria || '',
                grade: newSubject.grade || '',
                passed: newSubject.passed || false
            });
        }
    });
    
    // Update the subjects array
    this.subjects = mergedSubjects;
    this.lastUpdated = new Date();
    
    return this;
};

const AcademicProgress = mongoose.model('AcademicProgress', academicProgressSchema);

module.exports = AcademicProgress;